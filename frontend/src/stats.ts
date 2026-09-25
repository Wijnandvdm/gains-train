import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from './api/client'

export const statsKeys = {
  overview: ['stats-overview'] as const,
  exercise: (id: number) => ['exercise-stats', id] as const,
}

/** Records and per-session progress for one exercise (finished workouts only). */
export function useExerciseStats(exerciseId: number) {
  return useQuery({
    queryKey: statsKeys.exercise(exerciseId),
    queryFn: () =>
      unwrap(
        api.GET('/api/stats/exercises/{exercise_id}', {
          params: { path: { exercise_id: exerciseId } },
        }),
      ),
    staleTime: 5 * 60 * 1000,
    enabled: Number.isInteger(exerciseId),
  })
}

/** Every exercise you've done: the dashboard. */
export function useStatsOverview() {
  return useQuery({
    queryKey: statsKeys.overview,
    queryFn: () => unwrap(api.GET('/api/stats/overview')),
  })
}
