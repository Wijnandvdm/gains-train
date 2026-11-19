/**
 * Your routine on the device: days done in rotation (Day1 → Day2 → Day3 → Day1 …).
 * (A port of the former backend's routine service; same rules.)
 */
import { uuid } from '../lib/uuid'
import { db, getStoredRoutine } from './db'
import type { ExerciseId, ExerciseSummary, Routine, StoredRoutine, StoredWorkout } from './types'
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
): Routine {
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

type RoutineInput = {
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

/**
 * A change made during a workout, to make the routine day's standard (asked right after you
 * make it): the day's exercises in the workout's order, an exercise added at the same place
 * (after `after`, the exercise before it in the workout; first when null), or one taken out.
 */
export type DayChange =
  | { kind: 'order'; exerciseIds: ExerciseId[] }
  | { kind: 'add'; exerciseId: ExerciseId; after: ExerciseId | null; sets: number }
  | { kind: 'remove'; exerciseId: ExerciseId }

type DayExercise = StoredRoutine['days'][number]['exercises'][number]

export function applyDayChange(exercises: DayExercise[], change: DayChange): DayExercise[] {
  switch (change.kind) {
    case 'order': {
      // Exercises the workout doesn't have keep their place relative to each other, at the end.
      const rank = (e: DayExercise) => {
        const i = change.exerciseIds.indexOf(e.exercise_id)
        return i < 0 ? Infinity : i
      }
      return exercises
        .map((e, i) => ({ e, i }))
        .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
        .map(({ e }) => e)
    }
    case 'add': {
      if (exercises.some((e) => e.exercise_id === change.exerciseId)) return exercises
      const at = change.after ? exercises.findIndex((e) => e.exercise_id === change.after) + 1 : 0
      const added = { exercise_id: change.exerciseId, sets: Math.min(20, Math.max(1, change.sets)) }
      return [...exercises.slice(0, at), added, ...exercises.slice(at)]
    }
    case 'remove':
      return exercises.filter((e) => e.exercise_id !== change.exerciseId)
  }
}

/** Make a change from a workout the routine day's standard, from now on. */
export async function changeRoutineDay(dayId: string, change: DayChange): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const routine = await getStoredRoutine()
    const day = routine?.days.find((d) => d.id === dayId)
    if (!routine || !day) throw new RoutineError('This routine day doesn’t exist (anymore)')
    day.exercises = applyDayChange(day.exercises, change)
    await db.kv.put({ key: 'routine', value: routine })
  })
}

export async function deleteRoutine(): Promise<void> {
  await db.transaction('rw', db.kv, db.workouts, async () => {
    await db.kv.delete('routine')
    await unlinkWorkouts(new Set())
  })
}
