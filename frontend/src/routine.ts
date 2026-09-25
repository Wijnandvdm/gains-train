import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from './api/client'
import type { RoutineIn, RoutineOut } from './api/schema'
import { meQueryKey } from './auth'

export const routineKey = ['routine'] as const

/** Your routine (null if you train without one), including which day is up next. */
export function useRoutine() {
  return useQuery({
    queryKey: routineKey,
    queryFn: () => unwrap(api.GET('/api/routine')),
  })
}

function useRoutineMutation<T>(mutationFn: (arg: T) => Promise<RoutineOut | null | undefined>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (routine) => queryClient.setQueryData(routineKey, routine ?? null),
  })
}

export function useSaveRoutine() {
  return useRoutineMutation((body: RoutineIn) => unwrap(api.PUT('/api/routine', { body })))
}

/** Turn the named workouts in your history (e.g. Day1/2/3) into your routine. */
export function useRoutineFromHistory() {
  return useRoutineMutation(() => unwrap(api.POST('/api/routine/from-history')))
}

export function useDeleteRoutine() {
  return useRoutineMutation(async () => {
    await unwrap(api.DELETE('/api/routine'))
    return null
  })
}

/** Marks the first-open questions as answered. */
export function useCompleteSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.PATCH('/api/me', { body: { setup_completed: true } })),
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
  })
}
