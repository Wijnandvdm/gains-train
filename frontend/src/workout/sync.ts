import { api } from '../api/client'
import type { Op } from './ops'
import { Outbox, type SendResult } from './outbox'

/** Sends one op to the API and classifies the outcome for the outbox. */
export async function sendOp(op: Op): Promise<SendResult> {
  let response: Response
  let error: unknown
  try {
    ;({ response, error } = await request(op))
  } catch {
    return 'retry' // network error: offline, DNS, server down…
  }
  if (response.ok) return 'ok'
  if (response.status === 401) return 'unauthorized'
  if (response.status >= 500 || response.status === 408 || response.status === 429) return 'retry'
  const detail =
    error && typeof error === 'object' && 'detail' in error && typeof error.detail === 'string'
      ? error.detail
      : `Error ${response.status}`
  return { dropped: `A change couldn't be saved: ${detail}` }
}

function request(op: Op) {
  switch (op.type) {
    case 'startWorkout':
      return api.POST('/api/workouts', { body: { id: op.workoutId, ...op.workout } })
    case 'addExercise':
      return api.POST('/api/workouts/{workout_id}/exercises', {
        params: { path: { workout_id: op.workoutId } },
        body: { id: op.workoutExerciseId, exercise_id: op.exercise.id },
      })
    case 'removeExercise':
      return api.DELETE('/api/workout-exercises/{workout_exercise_id}', {
        params: { path: { workout_exercise_id: op.workoutExerciseId } },
      })
    case 'putSet': {
      const { id, ...body } = op.set
      return api.PUT('/api/sets/{set_id}', { params: { path: { set_id: id } }, body })
    }
    case 'deleteSet':
      return api.DELETE('/api/sets/{set_id}', { params: { path: { set_id: op.setId } } })
    case 'finishWorkout':
      return api.POST('/api/workouts/{workout_id}/finish', {
        params: { path: { workout_id: op.workoutId } },
        body: { ended_at: op.endedAt },
      })
    case 'discardWorkout':
      return api.DELETE('/api/workouts/{workout_id}', {
        params: { path: { workout_id: op.workoutId } },
      })
  }
}

function browserStorage() {
  try {
    return window.localStorage
  } catch {
    return null // blocked (e.g. some private modes): the queue then lives in memory only
  }
}

/** The app's single outbox. */
export const outbox = new Outbox(sendOp, browserStorage())
