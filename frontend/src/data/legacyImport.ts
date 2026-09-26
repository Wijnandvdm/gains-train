/**
 * Import the legacy Google Sheets log ("gainz - Log.csv") into the device.
 * (A port of the former backend's legacy_sheet.py + legacy_loader.py; same rules.)
 *
 * Columns: Date, Day, Exercise, Set, Weight (kg), Reps, Muscle Group, Notes, plus an
 * optional unnamed trailing column with workout notes. The sheet has one row per set and no
 * workout boundaries, so consecutive rows with the same Day code form one workout, as long
 * as the date doesn't jump by more than a day (sessions run past midnight). Missing dates
 * are filled from the row above. Re-importing updates the same workouts (by import key).
 */
import { uuid } from '../lib/uuid'
import { db } from './db'
import { loadLibrary } from './library'
import type { ExerciseDetail, SetOut, StoredWorkout } from './types'

export class LegacyImportError extends Error {}

const REQUIRED_COLUMNS = ['Date', 'Day', 'Exercise', 'Weight (kg)', 'Reps'] as const

/** How legacy exercise names map onto the library (else: an exact name match). */
export const LEGACY_MAPPING: {
  library: Record<string, string>
  custom: Record<string, Omit<ExerciseDetail, 'id' | 'name' | 'is_custom' | 'image_urls'>>
} = {
  library: {
    'Leg Curl': 'Seated_Leg_Curl',
    'Leg Extension': 'Leg_Extensions',
    'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
    'Seated Cable Row': 'Seated_Cable_Rows',
    'Overhead Cable Tricep Extension': 'Cable_Rope_Overhead_Triceps_Extension',
    'Dumbbell Press': 'Dumbbell_Bench_Press',
    'Incline Seated Bicep Curl': 'Incline_Dumbbell_Curl',
    'Preacher Curl': 'Preacher_Curl',
  },
  custom: {
    // Rear-foot-elevated split squat; the library only has the both-feet-down version.
    'Bulgarian Split Squat': {
      equipment: 'dumbbell',
      category: 'strength',
      level: null,
      mechanic: 'compound',
      force: 'push',
      primary_muscles: ['glutes', 'quadriceps'],
      secondary_muscles: ['adductors', 'hamstrings'],
      instructions: [],
    },
  },
}

// --- CSV ----------------------------------------------------------------------------------

/** RFC 4180 CSV: quoted fields may contain commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const input = text.replace(/^﻿/, '') // byte-order mark from spreadsheet exports
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      rows.push([...row, field])
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) rows.push([...row, field])
  return rows
}

// --- Parsing the sheet --------------------------------------------------------------------

export type ParsedSet = {
  position: number
  weight_kg: number | null
  reps: number | null
  notes: string | null
}
export type ParsedExercise = { name: string; sets: ParsedSet[] }
export type ParsedWorkout = {
  import_key: string
  performed_on: string
  day_code: string
  name: string
  notes: string[]
  exercises: ParsedExercise[]
  last_date: string
}
export type ParseResult = { workouts: ParsedWorkout[]; warnings: string[] }

function parseDecimal(raw: string): number | null {
  const value = raw.trim().replace(',', '.')
  if (!value) return null
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`not a number: '${raw.trim()}'`)
  const n = Number(value)
  if (n < 0) throw new Error(`negative value: '${raw.trim()}'`)
  return n
}

function parseWhole(raw: string): number | null {
  const n = parseDecimal(raw)
  if (n !== null && !Number.isInteger(n)) throw new Error(`not a whole number: '${raw.trim()}'`)
  return n
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function parseLegacyLog(text: string): ParseResult {
  const [header, ...rows] = parseCsv(text)
  const columns = (header ?? []).map((h) => h.trim())
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c))
  if (missing.length) {
    throw new LegacyImportError(
      `This doesn't look like the legacy log: missing column(s) ${missing.join(', ')}`,
    )
  }

  const workouts: ParsedWorkout[] = []
  const warnings: string[] = []
  let current: ParsedWorkout | null = null
  let lastDate: string | null = null

  rows.forEach((cells, index) => {
    const line = index + 2 // line 1 is the header
    const row: Record<string, string> = {}
    columns.forEach((name, i) => (row[name] = (cells[i] ?? '').trim()))
    // The unnamed column, and anything beyond the header, holds workout-level notes.
    const extra = [row[''] ?? '', ...cells.slice(columns.length)]
      .map((v) => v.trim())
      .filter(Boolean)

    if (!REQUIRED_COLUMNS.some((c) => row[c])) return // blank row
    const exerciseName = row['Exercise']!
    const dayCode = row['Day']!
    if (!exerciseName || !dayCode) {
      warnings.push(`line ${line}: skipped, missing exercise or day`)
      return
    }

    let date: string
    if (row['Date']) {
      if (!isIsoDate(row['Date'])) {
        warnings.push(`line ${line}: skipped, invalid date '${row['Date']}'`)
        return
      }
      date = row['Date']
    } else if (lastDate) {
      date = lastDate
      warnings.push(`line ${line}: missing date, used ${date} from the row above`)
    } else {
      warnings.push(`line ${line}: skipped, missing date and no earlier row`)
      return
    }

    let weight: number | null
    let reps: number | null
    try {
      weight = parseDecimal(row['Weight (kg)']!)
      reps = parseWhole(row['Reps']!)
    } catch (e) {
      warnings.push(`line ${line}: skipped, ${(e as Error).message}`)
      return
    }
    if (weight === null)
      warnings.push(`line ${line}: ${exerciseName} has no weight, imported without it`)
    if (reps === null)
      warnings.push(`line ${line}: ${exerciseName} has no reps, imported without them`)

    const startsNew =
      !current ||
      current.day_code !== dayCode ||
      daysBetween(current.last_date, date) > 1 ||
      date < current.last_date
    if (startsNew) {
      const group = row['Muscle Group'] ?? ''
      current = {
        import_key: `legacy-sheet:${date}:${dayCode}`,
        performed_on: date,
        day_code: dayCode,
        name: group ? `${dayCode} · ${group}` : dayCode,
        notes: [],
        exercises: [],
        last_date: date,
      }
      workouts.push(current)
    }
    const workout = current!
    workout.last_date = date
    workout.notes.push(...extra)
    let exercise = workout.exercises.find((e) => e.name === exerciseName)
    if (!exercise) {
      exercise = { name: exerciseName, sets: [] }
      workout.exercises.push(exercise)
    }
    exercise.sets.push({
      position: exercise.sets.length + 1,
      weight_kg: weight,
      reps,
      notes: row['Notes'] || null,
    })
    lastDate = date
  })

  // Two separate workouts with the same date + day code get a numeric suffix.
  const seen = new Map<string, number>()
  for (const w of workouts) {
    const n = (seen.get(w.import_key) ?? 0) + 1
    seen.set(w.import_key, n)
    if (n > 1) w.import_key = `${w.import_key}:${n}`
  }
  return { workouts, warnings }
}

// --- Writing it to the device -------------------------------------------------------------

export type ImportResult = {
  created: number
  updated: number
  sets: number
  /** legacy name → exercise name it was mapped to ("(custom)" for custom ones) */
  exerciseMap: Record<string, string>
  warnings: string[]
}

/**
 * Save the parsed workouts. Names resolve via LEGACY_MAPPING.library, then an existing
 * custom exercise, then LEGACY_MAPPING.custom (created), then an exact library name.
 * Unmapped names stop the import (nothing is written) with a list of them.
 */
export async function importLegacyLog(
  parsed: ParseResult,
  library: Map<string, ExerciseDetail>,
  mapping = LEGACY_MAPPING,
): Promise<ImportResult> {
  return db.transaction('rw', db.workouts, db.customExercises, async () => {
    const customs = await db.customExercises.toArray()
    const newCustoms: ExerciseDetail[] = []
    const resolved = new Map<string, ExerciseDetail>()
    const problems: string[] = []
    const byLowerName = (list: Iterable<ExerciseDetail>, name: string) =>
      [...list].filter((e) => e.name.toLowerCase() === name.toLowerCase())

    const names = [
      ...new Set(parsed.workouts.flatMap((w) => w.exercises.map((e) => e.name))),
    ].sort()
    for (const name of names) {
      const librarySlug = mapping.library[name]
      const spec = mapping.custom[name]
      if (librarySlug) {
        const e = library.get(librarySlug)
        if (e) resolved.set(name, e)
        else problems.push(`'${name}' → library id '${librarySlug}' doesn't exist`)
      } else if (byLowerName(customs, name)[0]) {
        resolved.set(name, byLowerName(customs, name)[0]!)
      } else if (spec) {
        const custom: ExerciseDetail = {
          id: `custom-${uuid()}`,
          name,
          is_custom: true,
          image_urls: [],
          ...spec,
        }
        newCustoms.push(custom)
        resolved.set(name, custom)
      } else {
        const matches = byLowerName(library.values(), name)
        if (matches.length === 1) resolved.set(name, matches[0]!)
        else problems.push(`'${name}' isn't mapped to an exercise`)
      }
    }
    if (problems.length) {
      throw new LegacyImportError(`Can't map all exercises:\n${problems.join('\n')}`)
    }
    await db.customExercises.bulkAdd(newCustoms)

    const existing = new Map(
      (
        await db.workouts
          .where('import_key')
          .anyOf(parsed.workouts.map((w) => w.import_key))
          .toArray()
      ).map((w) => [w.import_key!, w]),
    )
    let sets = 0
    const rows: StoredWorkout[] = parsed.workouts.map((p) => {
      const old = existing.get(p.import_key)
      const exercises = p.exercises.map((e, i) => {
        const weId = uuid()
        sets += e.sets.length
        return {
          id: weId,
          exercise_id: resolved.get(e.name)!.id,
          position: i + 1,
          notes: null,
          sets: e.sets.map((s): SetOut => ({
            id: uuid(),
            workout_exercise_id: weId,
            position: s.position,
            weight_kg: s.weight_kg,
            reps: s.reps,
            rpe: null,
            is_warmup: false,
            notes: s.notes,
            completed_at: null,
          })),
        }
      })
      return {
        id: old?.id ?? uuid(),
        name: p.name,
        routine_day_id: old?.routine_day_id ?? null,
        performed_on: p.performed_on,
        status: 'completed',
        started_at: null,
        ended_at: null,
        notes: p.notes.join('\n') || null,
        import_key: p.import_key,
        exercises,
        exercise_ids: [...new Set(exercises.map((e) => e.exercise_id))],
      }
    })
    await db.workouts.bulkPut(rows)

    return {
      created: rows.length - existing.size,
      updated: existing.size,
      sets,
      exerciseMap: Object.fromEntries(
        [...resolved].map(([legacy, e]) => [legacy, e.is_custom ? `${e.name} (custom)` : e.name]),
      ),
      warnings: parsed.warnings,
    }
  })
}

/** Import a picked CSV export of the sheet's Log tab. */
export async function importLegacyFile(file: Blob): Promise<ImportResult> {
  return importLegacyLog(parseLegacyLog(await file.text()), await loadLibrary())
}
