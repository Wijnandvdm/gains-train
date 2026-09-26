import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api, unwrap } from './api/client'
import type { ExerciseSummary, MeUpdate } from './api/schema'
import { meQueryKey, useMe } from './auth'
import { DEFAULT_REST_SECONDS, restSecondsFor } from './lib/rest'
import { useRestTimer } from './workout/restTimer'

const preferencesKey = ['exercise-preferences'] as const
type RestMap = ReadonlyMap<number, number>

/** Your per-exercise rest times (exercise id → seconds; 0 = no timer). */
export function useExercisePreferences() {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: async (): Promise<RestMap> =>
      new Map(
        (await unwrap(api.GET('/api/exercise-preferences'))).map((p) => [
          p.exercise_id,
          p.rest_seconds,
        ]),
      ),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Set an exercise's rest time (seconds, 0 = no timer) or null to go back to automatic.
 * Applied on screen immediately; if offline, it's sent once the connection is back.
 */
export function useSetRest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ exerciseId, seconds }: { exerciseId: number; seconds: number | null }) =>
      seconds === null
        ? unwrap(
            api.DELETE('/api/exercise-preferences/{exercise_id}', {
              params: { path: { exercise_id: exerciseId } },
            }),
          )
        : unwrap(
            api.PUT('/api/exercise-preferences/{exercise_id}', {
              params: { path: { exercise_id: exerciseId } },
              body: { rest_seconds: seconds },
            }),
          ),
    onMutate: ({ exerciseId, seconds }) => {
      queryClient.setQueryData<RestMap>(preferencesKey, (current) => {
        const next = new Map(current)
        if (seconds === null) next.delete(exerciseId)
        else next.set(exerciseId, seconds)
        return next
      })
    },
    onError: () => queryClient.invalidateQueries({ queryKey: preferencesKey }),
  })
}

/** Change your account's rest settings (timer on/off, default rest). */
export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: MeUpdate) => unwrap(api.PATCH('/api/me', { body })),
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
  })
}

/**
 * How long to rest after a set of this exercise; 0 when there should be no timer
 * (switched off in the account menu, or for this exercise).
 */
export function useRestFor(): (exercise: ExerciseSummary) => number {
  const { data: me } = useMe()
  const { data: preferences } = useExercisePreferences()
  return useCallback(
    (exercise: ExerciseSummary) =>
      me && !me.rest_timer_enabled
        ? 0
        : restSecondsFor(
            exercise,
            preferences ?? new Map(),
            me?.default_rest_seconds ?? DEFAULT_REST_SECONDS,
          ),
    [me, preferences],
  )
}

/**
 * The rest timer, wired to your preferences: `startFor(exercise)` runs it for that
 * exercise's rest time (or not at all), and ±15s on the timer is remembered for it.
 */
export function useExerciseRestTimer() {
  const restFor = useRestFor()
  const setRest = useSetRest()
  const timer = useRestTimer({
    onAdjust: (exerciseId, seconds) => setRest.mutate({ exerciseId, seconds }),
  })
  const { start } = timer
  const startFor = useCallback(
    (exercise: ExerciseSummary) => {
      const seconds = restFor(exercise)
      if (seconds > 0) start(seconds, exercise.id)
    },
    [restFor, start],
  )
  return { ...timer, startFor }
}
