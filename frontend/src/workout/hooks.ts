import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { api, unwrap } from '../api/client'
import type { ExerciseSummary, SetOut, WorkoutDetail } from '../api/schema'
import { localDateString } from '../lib/format'
import { uuid } from '../lib/uuid'
import { applyOp, applyOps, type Op } from './ops'
import { outbox } from './sync'

export const workoutKeys = {
  all: ['workouts'] as const,
  active: ['workouts', 'active'] as const,
  list: ['workouts', 'list'] as const,
  detail: (id: string) => ['workouts', 'detail', id] as const,
}
const historyKey = (exerciseId: number) => ['exercise-history', exerciseId] as const

/** The workout in progress (null if none), including changes not yet synced. */
export function useActiveWorkout() {
  return useQuery({
    queryKey: workoutKeys.active,
    queryFn: async () =>
      applyOps(await unwrap(api.GET('/api/workouts/active')), outbox.pendingOps()),
  })
}

/** Your previous session of an exercise, for "last time" hints. */
export function useLastTime(exerciseId: number) {
  return useQuery({
    queryKey: historyKey(exerciseId),
    queryFn: () =>
      unwrap(
        api.GET('/api/exercises/{exercise_id}/history', {
          params: { path: { exercise_id: exerciseId }, query: { limit: 1 } },
        }),
      ),
    select: (sessions) => sessions[0] ?? null,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOutboxStatus() {
  return useSyncExternalStore(outbox.subscribe, outbox.getStatus)
}

/**
 * Keeps the outbox flowing: retries when the device comes back online or the app is
 * reopened, and refreshes server data once everything has synced. Mount once, app-wide.
 */
export function useOutboxSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const flush = () => void outbox.flush()
    const onVisible = () => document.visibilityState === 'visible' && flush()
    const stopDrained = outbox.onDrained(() => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['exercise-history'] })
    })
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisible)
    flush() // anything left over from last time
    return () => {
      stopDrained()
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [queryClient])
}

/** Actions on the active workout. They update the screen at once and sync in the background. */
export function useWorkoutActions() {
  const queryClient = useQueryClient()

  function run(op: Op) {
    // Stop an in-flight refetch from overwriting this optimistic change with older data.
    void queryClient.cancelQueries({ queryKey: workoutKeys.active })
    queryClient.setQueryData<WorkoutDetail | null>(workoutKeys.active, (current) =>
      applyOp(current ?? null, op),
    )
    outbox.enqueue(op)
  }

  return {
    /** Start a workout; optionally with the same exercises as a previous one. */
    async start({ name, copyFrom }: { name?: string | null; copyFrom?: string } = {}) {
      const workoutId = uuid()
      let exercises: ExerciseSummary[] = []
      if (copyFrom) {
        try {
          const previous = await queryClient.fetchQuery({
            queryKey: workoutKeys.detail(copyFrom),
            queryFn: () => fetchWorkout(copyFrom),
          })
          exercises = previous.exercises.map((we) => we.exercise)
        } catch {
          // Offline: start empty rather than not at all.
        }
      }
      run({
        type: 'startWorkout',
        key: uuid(),
        workoutId,
        workout: {
          name: name ?? null,
          performed_on: localDateString(),
          started_at: new Date().toISOString(),
        },
      })
      for (const exercise of exercises) {
        run({ type: 'addExercise', key: uuid(), workoutId, workoutExerciseId: uuid(), exercise })
      }
    },
    addExercise(workoutId: string, exercise: ExerciseSummary) {
      run({ type: 'addExercise', key: uuid(), workoutId, workoutExerciseId: uuid(), exercise })
    },
    removeExercise(workoutId: string, workoutExerciseId: string) {
      run({ type: 'removeExercise', key: uuid(), workoutId, workoutExerciseId })
    },
    saveSet(workoutId: string, set: SetOut) {
      run({ type: 'putSet', key: uuid(), workoutId, set })
    },
    deleteSet(workoutId: string, set: SetOut) {
      run({
        type: 'deleteSet',
        key: uuid(),
        workoutId,
        setId: set.id,
        workoutExerciseId: set.workout_exercise_id,
      })
    },
    finish(workoutId: string) {
      run({ type: 'finishWorkout', key: uuid(), workoutId, endedAt: new Date().toISOString() })
    },
    discard(workoutId: string) {
      run({ type: 'discardWorkout', key: uuid(), workoutId })
    },
  }
}

// --- History ------------------------------------------------------------------------------

function fetchWorkout(id: string) {
  return unwrap(api.GET('/api/workouts/{workout_id}', { params: { path: { workout_id: id } } }))
}

export function useWorkoutHistory() {
  return useInfiniteQuery({
    queryKey: workoutKeys.list,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/workouts', { params: { query: { limit: 20, offset: pageParam } } })),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.limit : undefined,
    placeholderData: keepPreviousData,
  })
}

export function useWorkout(id: string) {
  return useQuery({ queryKey: workoutKeys.detail(id), queryFn: () => fetchWorkout(id) })
}

/** Deleting a past workout isn't queued: it needs a connection, and says so if it fails. */
export function useDeleteWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/workouts/{workout_id}', { params: { path: { workout_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  })
}
