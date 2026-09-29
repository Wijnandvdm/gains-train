/**
 * Workouts on the device: the old API's workout endpoints, as functions on IndexedDB.
 * Each workout is one document with its exercises and sets nested inside.
 */
import { uuid } from '../lib/uuid'
import { db } from './db'
import type {
  ExerciseId,
  ExerciseSession,
  ExerciseSummary,
  WorkoutSet,
  StoredWorkout,
  WorkoutDetail,
  WorkoutSummary,
} from './types'

export class WorkoutError extends Error {}

// --- Reading ------------------------------------------------------------------------------

/** Most recent first; imported workouts have no start time, so the date decides first. */
export function newestFirst(a: StoredWorkout, b: StoredWorkout): number {
  return (
    b.performed_on.localeCompare(a.performed_on) ||
    (b.started_at ?? '').localeCompare(a.started_at ?? '') ||
    b.id.localeCompare(a.id)
  )
}

export async function getWorkout(id: string): Promise<StoredWorkout | undefined> {
  return db.workouts.get(id)
}

export async function activeWorkout(): Promise<StoredWorkout | undefined> {
  return db.workouts.where('status').equals('in_progress').first()
}

/** Workouts between two dates (inclusive, either may be open), newest first. */
export async function workoutsBetween(from?: string, to?: string): Promise<StoredWorkout[]> {
  const rows = await db.workouts
    .where('performed_on')
    .between(from ?? '0000-00-00', to ?? '9999-99-99', true, true)
    .toArray()
  return rows.sort(newestFirst)
}

/** Your previous finished sessions of an exercise, newest first (for "last time"). */
export async function exerciseSessions(
  exerciseId: ExerciseId,
  limit = 1,
): Promise<ExerciseSession[]> {
  const workouts = (await db.workouts.where('exercise_ids').equals(exerciseId).toArray())
    .filter((w) => w.status === 'completed')
    .sort(newestFirst)
  const sessions: ExerciseSession[] = []
  for (const w of workouts) {
    // Normally once per workout; if an exercise was done twice, the later entry first.
    for (const we of [...w.exercises].reverse()) {
      if (we.exercise_id !== exerciseId) continue
      sessions.push({
        workout_id: w.id,
        performed_on: w.performed_on,
        sets: we.sets,
      })
      if (sessions.length === limit) return sessions
    }
  }
  return sessions
}

// --- Turning stored workouts into what the screens show -----------------------------------

type ExerciseLookup = (id: ExerciseId) => ExerciseSummary

/**
 * A set that was actually done: weight and reps, not a warm-up, and ticked off (imported
 * workouts have no tick timestamps, but every set in them was done).
 */
/** A new set row: a work set, empty and not ticked off, unless `fields` say otherwise. */
export function newSet(
  workoutExerciseId: string,
  position: number,
  fields: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'notes' | 'completed_at'>> = {},
): WorkoutSet {
  return {
    id: uuid(),
    workout_exercise_id: workoutExerciseId,
    position,
    weight_kg: null,
    reps: null,
    is_warmup: false,
    notes: null,
    completed_at: null,
    ...fields,
  }
}

export function isPerformed(set: WorkoutSet, workout: Pick<StoredWorkout, 'import_key'>): boolean {
  return (
    set.weight_kg !== null &&
    set.reps !== null &&
    !set.is_warmup &&
    (set.completed_at !== null || workout.import_key !== null)
  )
}

export function hydrate(w: StoredWorkout, lookup: ExerciseLookup): WorkoutDetail {
  const { exercise_ids: _, import_key: __, ...rest } = w
  return {
    ...rest,
    exercises: w.exercises.map(({ exercise_id, ...we }) => ({
      ...we,
      exercise: lookup(exercise_id),
    })),
  }
}

export function summarize(w: StoredWorkout, lookup: ExerciseLookup): WorkoutSummary {
  const done = w.exercises.flatMap((we) => we.sets).filter((s) => isPerformed(s, w))
  return {
    id: w.id,
    name: w.name,
    routine_day_id: w.routine_day_id,
    performed_on: w.performed_on,
    status: w.status,
    started_at: w.started_at,
    ended_at: w.ended_at,
    exercise_names: w.exercises.map((we) => lookup(we.exercise_id).name),
    set_count: done.length,
    volume_kg: done.reduce((sum, s) => sum + s.weight_kg! * s.reps!, 0),
  }
}

// --- Writing ------------------------------------------------------------------------------

/** Apply a change to one workout (keeping its derived fields in step). */
async function modify(workoutId: string, change: (w: StoredWorkout) => void): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId)
    if (!workout) throw new WorkoutError('Workout not found')
    change(workout)
    workout.exercises.forEach((we, i) => (we.position = i + 1))
    workout.exercise_ids = [...new Set(workout.exercises.map((we) => we.exercise_id))]
    await db.workouts.put(workout)
  })
}

export async function startWorkout(options: {
  id?: string
  name: string | null
  performed_on: string
  started_at: string
  routine_day_id: string | null
}): Promise<string> {
  const id = options.id ?? uuid()
  await db.transaction('rw', db.workouts, async () => {
    if (await activeWorkout()) throw new WorkoutError('Another workout is already in progress')
    await db.workouts.add({
      id,
      name: options.name,
      routine_day_id: options.routine_day_id,
      performed_on: options.performed_on,
      status: 'in_progress',
      started_at: options.started_at,
      ended_at: null,
      notes: null,
      import_key: null,
      exercises: [],
      exercise_ids: [],
    })
  })
  return id
}

export async function addExercise(
  workoutId: string,
  exerciseId: ExerciseId,
  workoutExerciseId: string = uuid(),
): Promise<string> {
  await modify(workoutId, (w) => {
    w.exercises.push({
      id: workoutExerciseId,
      exercise_id: exerciseId,
      position: w.exercises.length + 1,
      notes: null,
      sets: [],
    })
  })
  return workoutExerciseId
}

export async function removeExercise(workoutId: string, workoutExerciseId: string): Promise<void> {
  await modify(workoutId, (w) => {
    w.exercises = w.exercises.filter((we) => we.id !== workoutExerciseId)
  })
}

/** Create or replace a set (matched by id). */
export async function saveSet(workoutId: string, set: WorkoutSet): Promise<void> {
  await modify(workoutId, (w) => {
    const we = w.exercises.find((e) => e.id === set.workout_exercise_id)
    if (!we) throw new WorkoutError('Exercise not found in this workout')
    we.sets = [...we.sets.filter((s) => s.id !== set.id), set].sort(
      (a, b) => a.position - b.position,
    )
  })
}

export async function deleteSet(workoutId: string, setId: string): Promise<void> {
  await modify(workoutId, (w) => {
    for (const we of w.exercises) we.sets = we.sets.filter((s) => s.id !== setId)
  })
}

export async function finishWorkout(workoutId: string, endedAt = new Date().toISOString()) {
  await modify(workoutId, (w) => {
    if (w.status === 'in_progress') {
      w.status = 'completed'
      w.ended_at = endedAt
    }
  })
}

export async function updateWorkout(
  workoutId: string,
  patch: Partial<Pick<StoredWorkout, 'name' | 'notes' | 'performed_on'>>,
): Promise<void> {
  await modify(workoutId, (w) => Object.assign(w, patch))
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await db.workouts.delete(workoutId)
}
