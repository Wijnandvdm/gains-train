/**
 * Your routine on the device: days done in rotation (Day1 → Day2 → Day3 → Day1 …).
 * (A port of the former backend's routine service; same rules.)
 */
import { uuid } from '../lib/uuid'
import { db, getStoredRoutine } from './db'
import type { ExerciseId, ExerciseSummary, RoutineOut, StoredRoutine, StoredWorkout } from './types'
import { newestFirst } from './workouts'

export class RoutineError extends Error {}

/** The day after the last finished routine day (wrapping around); the first day if none. */
export function nextDayId(routine: StoredRoutine, workouts: StoredWorkout[]): string | null {
  const dayIds = routine.days.map((d) => d.id)
  if (dayIds.length === 0) return null
  const last = workouts
    .filter(
      (w) => w.status === 'completed' && w.routine_day_id && dayIds.includes(w.routine_day_id),
    )
    .sort(newestFirst)[0]
  if (!last) return dayIds[0]!
  return dayIds[(dayIds.indexOf(last.routine_day_id!) + 1) % dayIds.length]!
}

export function hydrateRoutine(
  routine: StoredRoutine,
  workouts: StoredWorkout[],
  lookup: (id: ExerciseId) => ExerciseSummary,
): RoutineOut {
  return {
    days: routine.days.map((d, i) => ({
      id: d.id,
      position: i + 1,
      name: d.name,
      exercises: d.exercises.map((e) => ({ exercise: lookup(e.exercise_id), sets: e.sets })),
    })),
    next_day_id: nextDayId(routine, workouts),
  }
}

/** Unlink workouts from days that no longer exist (they stay in your history). */
async function unlinkWorkouts(keepDayIds: Set<string>): Promise<void> {
  await db.workouts
    .filter((w) => w.routine_day_id !== null && !keepDayIds.has(w.routine_day_id))
    .modify({ routine_day_id: null })
}

export type RoutineInput = {
  days: {
    id?: string | null
    name: string
    exercises: { exercise_id: ExerciseId; sets: number }[]
  }[]
}

/**
 * Replace the routine. Days keep their id when sent with it, so workouts stay linked
 * (and the rotation keeps its place); days left out are removed.
 */
export async function saveRoutine(input: RoutineInput): Promise<StoredRoutine> {
  if (input.days.length < 1 || input.days.length > 14) {
    throw new RoutineError('A routine has 1 to 14 days')
  }
  const routine: StoredRoutine = {
    days: input.days.map((d) => {
      const name = d.name.trim()
      if (!name) throw new RoutineError('Every day needs a name')
      for (const e of d.exercises) {
        if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20) {
          throw new RoutineError('Sets must be 1 to 20')
        }
      }
      return { id: d.id ?? uuid(), name, exercises: d.exercises.map((e) => ({ ...e })) }
    }),
  }
  await db.transaction('rw', db.kv, db.workouts, async () => {
    await db.kv.put({ key: 'routine', value: routine })
    await unlinkWorkouts(new Set(routine.days.map((d) => d.id)))
  })
  return routine
}

export async function deleteRoutine(): Promise<void> {
  await db.transaction('rw', db.kv, db.workouts, async () => {
    await db.kv.delete('routine')
    await unlinkWorkouts(new Set())
  })
}

/** "Day2" sorts before "Day10". */
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

/**
 * Build a routine from the named workouts in your history (e.g. your Day1/2/3 split):
 * each name becomes a day with the exercises (and number of work sets) of its most recent
 * workout. Past workouts are linked to their day, so the rotation continues where you
 * left off. Replaces any existing routine. Returns null if there are no named workouts.
 */
export async function routineFromHistory(): Promise<StoredRoutine | null> {
  return db.transaction('rw', db.kv, db.workouts, async () => {
    const workouts = (await db.workouts.toArray())
      .filter((w) => w.status === 'completed' && w.name)
      .sort(newestFirst)
    const latestByName = new Map<string, StoredWorkout>()
    for (const w of workouts) if (!latestByName.has(w.name!)) latestByName.set(w.name!, w)
    if (latestByName.size === 0) return null

    const routine: StoredRoutine = {
      days: [...latestByName.keys()].sort(naturalCompare).map((name) => ({
        id: uuid(),
        name,
        exercises: latestByName.get(name)!.exercises.map((we) => ({
          exercise_id: we.exercise_id,
          sets: Math.max(1, Math.min(20, we.sets.filter((s) => !s.is_warmup).length)),
        })),
      })),
    }
    await db.kv.put({ key: 'routine', value: routine })
    const dayIdByName = new Map(routine.days.map((d) => [d.name, d.id]))
    await db.workouts.toCollection().modify((w) => {
      w.routine_day_id = (w.name && dayIdByName.get(w.name)) || null
    })
    return routine
  })
}

export { getStoredRoutine }
