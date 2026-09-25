import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, unwrap } from './api/client'

export type ExerciseSearch = {
  q?: string
  muscle?: string
  equipment?: string
}

const PAGE_SIZE = 30
// The library only changes when it's re-seeded, so cache it generously.
const LIBRARY_STALE_MS = 60 * 60 * 1000

export function useExerciseSearch(search: ExerciseSearch) {
  return useInfiniteQuery({
    queryKey: ['exercises', search],
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.GET('/api/exercises', {
          params: { query: { ...search, limit: PAGE_SIZE, offset: pageParam } },
          signal, // cancels superseded requests while typing
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.limit : undefined,
    // Keep showing the previous results while a new search loads (no flicker).
    placeholderData: keepPreviousData,
    staleTime: LIBRARY_STALE_MS,
  })
}

export function useExerciseFilters() {
  return useQuery({
    queryKey: ['exercise-filters'],
    queryFn: () => unwrap(api.GET('/api/exercises/filters')),
    staleTime: LIBRARY_STALE_MS,
  })
}

export function useExercise(id: number) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () =>
      unwrap(
        api.GET('/api/exercises/{exercise_id}', {
          params: { path: { exercise_id: id } },
        }),
      ),
    staleTime: LIBRARY_STALE_MS,
    enabled: Number.isInteger(id),
  })
}
