/**
 * Changes to the active workout, as data. Each op is
 *  1. applied to the cached workout straight away (so the UI updates instantly), and
 *  2. queued in the outbox, which sends it to the API when there's a connection.
 * Whenever the workout is re-fetched, still-pending ops are applied on top again, so the
 * screen never "loses" a change that hasn't reached the server yet.
 */
import type { ExerciseSummary, SetOut, WorkoutDetail, WorkoutExerciseOut } from '../api/schema'

type Base = { key: string; workoutId: string }

export type Op = Base &
  (
    | {
        type: 'startWorkout'
        workout: { name: string | null; performed_on: string; started_at: string }
      }
    | { type: 'addExercise'; workoutExerciseId: string; exercise: ExerciseSummary }
    | { type: 'removeExercise'; workoutExerciseId: string }
    | { type: 'putSet'; set: SetOut }
    | { type: 'deleteSet'; setId: string; workoutExerciseId: string }
    | { type: 'finishWorkout'; endedAt: string }
    | { type: 'discardWorkout' }
  )

/** Applies ops to the active workout (null = none). Pure: returns new objects. */
export function applyOps(active: WorkoutDetail | null, ops: readonly Op[]): WorkoutDetail | null {
  return ops.reduce(applyOp, active)
}

export function applyOp(active: WorkoutDetail | null, op: Op): WorkoutDetail | null {
  if (op.type === 'startWorkout') {
    if (active) return active // already started (or the server already has it)
    return {
      id: op.workoutId,
      name: op.workout.name,
      performed_on: op.workout.performed_on,
      started_at: op.workout.started_at,
      ended_at: null,
      status: 'in_progress',
      notes: null,
      exercises: [],
    }
  }
  if (!active || active.id !== op.workoutId) return active

  switch (op.type) {
    case 'addExercise':
      if (active.exercises.some((we) => we.id === op.workoutExerciseId)) return active
      return {
        ...active,
        exercises: [
          ...active.exercises,
          {
            id: op.workoutExerciseId,
            position: active.exercises.length + 1,
            notes: null,
            exercise: op.exercise,
            sets: [],
          },
        ],
      }
    case 'removeExercise':
      return {
        ...active,
        exercises: active.exercises
          .filter((we) => we.id !== op.workoutExerciseId)
          .map((we, i) => ({ ...we, position: i + 1 })),
      }
    case 'putSet':
      return updateExercise(active, op.set.workout_exercise_id, (we) => ({
        ...we,
        sets: [...we.sets.filter((s) => s.id !== op.set.id), op.set].sort(
          (a, b) => a.position - b.position,
        ),
      }))
    case 'deleteSet':
      return updateExercise(active, op.workoutExerciseId, (we) => ({
        ...we,
        sets: we.sets.filter((s) => s.id !== op.setId),
      }))
    case 'finishWorkout':
    case 'discardWorkout':
      return null // no longer the active workout
  }
}

function updateExercise(
  workout: WorkoutDetail,
  workoutExerciseId: string,
  update: (we: WorkoutExerciseOut) => WorkoutExerciseOut,
): WorkoutDetail {
  return {
    ...workout,
    exercises: workout.exercises.map((we) => (we.id === workoutExerciseId ? update(we) : we)),
  }
}
