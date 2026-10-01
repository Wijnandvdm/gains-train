/**
 * Backups: everything on the device in one file, and restoring from it. The data only lives
 * on your phone, so this file is your safety net (and how you move to a new phone).
 *
 * The file is a zip of CSV tables, so every part opens in a spreadsheet:
 *   workouts.csv          one row per set (readable columns first, ids last)
 *   routine.csv           one row per exercise in each routine day
 *   custom-exercises.csv  your own exercises
 *   rest-times.csv        your rest time per exercise
 *   settings.csv          your settings, plus the file's format, version and date
 * Older backups (one .json file, version 1) can still be imported.
 */
import { readCsv, toCsv } from '../lib/csv'
import { saveFile } from '../lib/saveFile'
import {
  db,
  DEFAULT_SETTINGS,
  getSettings,
  getStoredRoutine,
  type RestPref,
  updateSettings,
} from './db'
import { loadLibrary } from './library'
import { syncWithLibrary } from './migrate'
import type {
  ExerciseDetail,
  Settings,
  StoredRoutine,
  StoredWorkout,
  StoredWorkoutExercise,
} from './types'

export const BACKUP_FORMAT = 'gains-train-backup'
export const BACKUP_VERSION = 2
/** What the import file picker accepts: backups (.zip) and older ones (.json). */
export const BACKUP_FILE_TYPES = '.zip,application/zip,.json,application/json'
/** Reminder choices in months (0 = never). */
export const BACKUP_REMINDER_MONTHS = [1, 3, 6, 12, 0]

export type Backup = {
  format: typeof BACKUP_FORMAT
  version: number
  exported_at: string
  workouts: StoredWorkout[]
  custom_exercises: ExerciseDetail[]
  rest_prefs: RestPref[]
  routine: StoredRoutine | null
  settings: Settings
}

export class BackupError extends Error {}

export async function createBackup(now = new Date()): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    workouts: await db.workouts.toArray(),
    custom_exercises: await db.customExercises.toArray(),
    rest_prefs: await db.restPrefs.toArray(),
    routine: await getStoredRoutine(),
    settings: await getSettings(),
  }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gains-train-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`
}

/**
 * Make a backup and hand it to you (share sheet or download). Returns the backup, or null
 * when you closed the share sheet without saving it. Remembers when you last backed up.
 */
export async function exportBackup(now = new Date()): Promise<Backup | null> {
  const backup = await createBackup(now)
  const saved = await saveFile(backupFileName(now), await backupToZip(backup), 'application/zip')
  if (!saved) return null
  await updateSettings({ last_backup_at: backup.exported_at, backup_reminded_at: null })
  return backup
}

/** The zip library, loaded only when you export or import a backup. */
const zipLibrary = () => import('fflate')

// --- Writing ------------------------------------------------------------------------------

const WORKOUT_COLUMNS = [
  'date',
  'workout',
  'exercise',
  'set',
  'weight_kg',
  'reps',
  'warm_up',
  'set_notes',
  'done_at',
  'status',
  'started_at',
  'ended_at',
  'workout_notes',
  'exercise_notes',
  'workout_id',
  'routine_day_id',
  'import_key',
  'exercise_id',
  'workout_exercise_id',
  'exercise_position',
  'set_id',
]
const ROUTINE_COLUMNS = ['day', 'exercise', 'sets', 'day_id', 'exercise_id']
const CUSTOM_COLUMNS = [
  'name',
  'equipment',
  'category',
  'level',
  'mechanic',
  'force',
  'primary_muscles',
  'secondary_muscles',
  'instructions',
  'id',
]
const REST_COLUMNS = ['exercise', 'rest_seconds', 'exercise_id']
const SETTINGS_COLUMNS = ['setting', 'value']

const text = (v: string | number | null | undefined) =>
  v === null || v === undefined ? '' : String(v)
const yesNo = (v: boolean) => (v ? 'yes' : 'no')
/** Lists inside one cell: muscles separated by "; ", instruction steps one per line. */
const LIST = '; '

async function backupToZip(backup: Backup): Promise<Uint8Array> {
  const { strToU8, zipSync } = await zipLibrary()
  const library = await loadLibrary().catch(() => new Map<string, ExerciseDetail>())
  const customs = new Map(backup.custom_exercises.map((c) => [c.id, c]))
  const nameOf = (id: string) => library.get(id)?.name ?? customs.get(id)?.name ?? id

  const workouts = backup.workouts.flatMap((w) => {
    const common = {
      date: w.performed_on,
      workout: text(w.name),
      status: w.status,
      started_at: text(w.started_at),
      ended_at: text(w.ended_at),
      workout_notes: text(w.notes),
      workout_id: w.id,
      routine_day_id: text(w.routine_day_id),
      import_key: text(w.import_key),
    }
    if (w.exercises.length === 0) return [common]
    return w.exercises.flatMap((we) => {
      const exercise = {
        ...common,
        exercise: nameOf(we.exercise_id),
        exercise_notes: text(we.notes),
        exercise_id: we.exercise_id,
        workout_exercise_id: we.id,
        exercise_position: text(we.position),
      }
      if (we.sets.length === 0) return [exercise]
      return we.sets.map((s) => ({
        ...exercise,
        set: text(s.position),
        weight_kg: text(s.weight_kg),
        reps: text(s.reps),
        warm_up: yesNo(s.is_warmup),
        set_notes: text(s.notes),
        done_at: text(s.completed_at),
        set_id: s.id,
      }))
    })
  })

  const routine = (backup.routine?.days ?? []).flatMap((d) =>
    d.exercises.length === 0
      ? [{ day: d.name, day_id: d.id }]
      : d.exercises.map((e) => ({
          day: d.name,
          exercise: nameOf(e.exercise_id),
          sets: text(e.sets),
          day_id: d.id,
          exercise_id: e.exercise_id,
        })),
  )

  const custom = backup.custom_exercises.map((c) => ({
    name: c.name,
    equipment: text(c.equipment),
    category: text(c.category),
    level: text(c.level),
    mechanic: text(c.mechanic),
    force: text(c.force),
    primary_muscles: c.primary_muscles.join(LIST),
    secondary_muscles: c.secondary_muscles.join(LIST),
    instructions: c.instructions.join('\n'),
    id: c.id,
  }))

  const rest = backup.rest_prefs.map((r) => ({
    exercise: nameOf(r.exercise_id),
    rest_seconds: text(r.rest_seconds),
    exercise_id: r.exercise_id,
  }))

  const s = backup.settings
  const settings = Object.entries({
    format: backup.format,
    version: text(backup.version),
    exported_at: backup.exported_at,
    setup_completed_at: text(s.setup_completed_at),
    rest_timer_enabled: yesNo(s.rest_timer_enabled),
    default_rest_seconds: text(s.default_rest_seconds),
    weekly_target: text(s.weekly_target),
    depot_weeks: s.depot_weeks.join(LIST),
    backup_reminder_months: text(s.backup_reminder_months),
  }).map(([setting, value]) => ({ setting, value }))

  return zipSync({
    'workouts.csv': strToU8(toCsv(WORKOUT_COLUMNS, workouts)),
    'routine.csv': strToU8(toCsv(ROUTINE_COLUMNS, routine)),
    'custom-exercises.csv': strToU8(toCsv(CUSTOM_COLUMNS, custom)),
    'rest-times.csv': strToU8(toCsv(REST_COLUMNS, rest)),
    'settings.csv': strToU8(toCsv(SETTINGS_COLUMNS, settings)),
  })
}

// --- Reading ------------------------------------------------------------------------------

const orNull = (v: string | undefined) => (v === undefined || v === '' ? null : v)
function num(v: string | undefined, what: string): number | null {
  if (v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) throw new BackupError(`The backup is damaged (${what}: "${v}").`)
  return n
}
const list = (v: string | undefined) =>
  v
    ? v
        .split(LIST.trim())
        .map((x) => x.trim())
        .filter(Boolean)
    : []

function table(
  files: Record<string, Uint8Array>,
  name: string,
  required: string[],
  strFromU8: (bytes: Uint8Array) => string,
) {
  const file = files[name]
  if (!file) throw new BackupError(`The backup is incomplete (${name} is missing).`)
  try {
    return readCsv(strFromU8(file), required)
  } catch (e) {
    throw new BackupError(`The backup is damaged (${name}: ${(e as Error).message}).`)
  }
}

async function zipToBackup(bytes: Uint8Array): Promise<Backup> {
  const { strFromU8, unzipSync } = await zipLibrary()
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError("This isn't a Gains Train backup file.")
  }
  if (!files['settings.csv']) throw new BackupError("This isn't a Gains Train backup file.")
  const settingsRows = table(files, 'settings.csv', SETTINGS_COLUMNS, strFromU8)
  const setting = Object.fromEntries(settingsRows.map((r) => [r.setting!, r.value!]))
  if (setting.format !== BACKUP_FORMAT)
    throw new BackupError("This isn't a Gains Train backup file.")

  // Workouts: rows grouped by workout, then by exercise, in file order.
  const workouts = new Map<string, StoredWorkout>()
  const exercises = new Map<string, StoredWorkoutExercise>()
  for (const r of table(files, 'workouts.csv', ['date', 'workout_id'], strFromU8)) {
    let w = workouts.get(r.workout_id!)
    if (!w) {
      w = {
        id: r.workout_id!,
        name: orNull(r.workout),
        routine_day_id: orNull(r.routine_day_id),
        performed_on: r.date!,
        status: r.status === 'in_progress' ? 'in_progress' : 'completed',
        started_at: orNull(r.started_at),
        ended_at: orNull(r.ended_at),
        notes: orNull(r.workout_notes),
        import_key: orNull(r.import_key),
        exercises: [],
        exercise_ids: [],
      }
      workouts.set(w.id, w)
    }
    if (!r.workout_exercise_id) continue
    let we = exercises.get(r.workout_exercise_id)
    if (!we) {
      we = {
        id: r.workout_exercise_id,
        exercise_id: r.exercise_id!,
        position: num(r.exercise_position, 'exercise_position') ?? w.exercises.length + 1,
        notes: orNull(r.exercise_notes),
        sets: [],
      }
      exercises.set(we.id, we)
      w.exercises.push(we)
      if (!w.exercise_ids.includes(we.exercise_id)) w.exercise_ids.push(we.exercise_id)
    }
    if (!r.set_id) continue
    we.sets.push({
      id: r.set_id,
      workout_exercise_id: we.id,
      position: num(r.set, 'set') ?? we.sets.length + 1,
      weight_kg: num(r.weight_kg, 'weight_kg'),
      reps: num(r.reps, 'reps'),
      is_warmup: r.warm_up === 'yes',
      notes: orNull(r.set_notes),
      completed_at: orNull(r.done_at),
    })
  }

  // Routine: rows grouped by day, in file order.
  const days = new Map<string, StoredRoutine['days'][number]>()
  for (const r of table(files, 'routine.csv', ['day', 'day_id'], strFromU8)) {
    let day = days.get(r.day_id!)
    if (!day) {
      day = { id: r.day_id!, name: r.day!, exercises: [] }
      days.set(day.id, day)
    }
    if (r.exercise_id)
      day.exercises.push({ exercise_id: r.exercise_id, sets: num(r.sets, 'sets') ?? 3 })
  }

  const custom_exercises = table(files, 'custom-exercises.csv', ['id', 'name'], strFromU8).map(
    (r): ExerciseDetail => ({
      id: r.id!,
      name: r.name!,
      equipment: orNull(r.equipment),
      category: orNull(r.category),
      level: orNull(r.level),
      mechanic: orNull(r.mechanic),
      force: orNull(r.force),
      is_custom: true,
      primary_muscles: list(r.primary_muscles),
      secondary_muscles: list(r.secondary_muscles),
      image_urls: [],
      instructions: r.instructions ? r.instructions.split('\n') : [],
    }),
  )

  const rest_prefs = table(files, 'rest-times.csv', ['exercise_id', 'rest_seconds'], strFromU8).map(
    (r) => ({
      exercise_id: r.exercise_id!,
      rest_seconds: num(r.rest_seconds, 'rest_seconds') ?? 0,
    }),
  )

  return validateBackup({
    format: BACKUP_FORMAT,
    version: num(setting.version, 'version') ?? BACKUP_VERSION,
    exported_at: setting.exported_at ?? new Date().toISOString(),
    workouts: [...workouts.values()],
    custom_exercises,
    rest_prefs,
    routine: days.size ? { days: [...days.values()] } : null,
    settings: {
      ...DEFAULT_SETTINGS,
      setup_completed_at: orNull(setting.setup_completed_at),
      rest_timer_enabled: setting.rest_timer_enabled !== 'no',
      default_rest_seconds:
        num(setting.default_rest_seconds, 'default_rest_seconds') ??
        DEFAULT_SETTINGS.default_rest_seconds,
      weekly_target: num(setting.weekly_target, 'weekly_target') ?? DEFAULT_SETTINGS.weekly_target,
      depot_weeks: list(setting.depot_weeks),
      backup_reminder_months:
        num(setting.backup_reminder_months, 'backup_reminder_months') ??
        DEFAULT_SETTINGS.backup_reminder_months,
    },
  })
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Check a backup before it replaces anything (throws BackupError with a reason). */
function validateBackup(data: unknown): Backup {
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupError("This isn't a Gains Train backup file.")
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update first.')
  }
  for (const key of ['workouts', 'custom_exercises', 'rest_prefs'] as const) {
    if (!Array.isArray(data[key])) throw new BackupError(`The backup is damaged (${key}).`)
  }
  for (const w of data.workouts as unknown[]) {
    if (
      !isObject(w) ||
      typeof w.id !== 'string' ||
      typeof w.performed_on !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(w.performed_on) ||
      !Array.isArray(w.exercises) ||
      !Array.isArray(w.exercise_ids)
    ) {
      throw new BackupError('The backup is damaged (a workout is incomplete).')
    }
  }
  if (data.routine !== null && !(isObject(data.routine) && Array.isArray(data.routine.days))) {
    throw new BackupError('The backup is damaged (routine).')
  }
  return {
    ...(data as unknown as Backup),
    settings: { ...DEFAULT_SETTINGS, ...(isObject(data.settings) ? data.settings : {}) },
  }
}

/** Read and check a picked backup file (.zip, or an older .json); nothing is changed yet. */
export async function readBackupFile(file: Blob): Promise<Backup> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // Zip files start with "PK".
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return zipToBackup(bytes)
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new BackupError("This isn't a Gains Train backup file.")
  }
  return validateBackup(data)
}

/** Replace everything on the device with the backup's contents (all or nothing). */
export async function restoreBackup(backup: Backup): Promise<Backup> {
  await db.transaction('rw', db.workouts, db.customExercises, db.restPrefs, db.kv, async () => {
    await Promise.all([
      db.workouts.clear(),
      db.customExercises.clear(),
      db.restPrefs.clear(),
      db.kv.clear(),
    ])
    await db.workouts.bulkAdd(backup.workouts)
    await db.customExercises.bulkAdd(backup.custom_exercises)
    await db.restPrefs.bulkAdd(backup.rest_prefs)
    if (backup.routine) await db.kv.put({ key: 'routine', value: backup.routine })
    // The backup you restore from counts as your last backup.
    await db.kv.put({
      key: 'settings',
      value: { ...backup.settings, last_backup_at: backup.exported_at, backup_reminded_at: null },
    })
  })
  // A backup from an older version may use exercises that have left the library since.
  await syncWithLibrary().catch((e: unknown) => console.warn('Exercise library sync failed', e))
  return backup
}

// --- Reminder -----------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Whether to suggest a backup: your last one (or, if you never made one, your first
 * workout) is at least `backup_reminder_months` old, and you didn't say "not now" in the
 * past week. Never without workouts, or with the reminder switched off.
 */
export function backupDue(
  settings: Settings,
  firstWorkoutDay: string | null,
  now = new Date(),
): boolean {
  const months = settings.backup_reminder_months
  if (months <= 0 || !firstWorkoutDay) return false
  const since = new Date(settings.last_backup_at ?? `${firstWorkoutDay}T00:00:00`)
  const dueAt = new Date(since)
  dueAt.setMonth(dueAt.getMonth() + months)
  if (now < dueAt) return false
  const reminded = settings.backup_reminded_at ? new Date(settings.backup_reminded_at) : null
  return !reminded || now.getTime() - reminded.getTime() >= WEEK_MS
}
