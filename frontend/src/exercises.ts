import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from './data/db'
import {
  type ExerciseSearch,
  filterValues,
  loadLibrary,
  searchExercises,
  toSummary,
} from './data/library'
import type { ExerciseDetail, ExerciseFilters, ExerciseId, ExerciseSummary } from './data/types'

export type { ExerciseSearch }

/** The exercise library (loaded once), or an error if it couldn't be loaded. */
function useLibrary(): { library?: Map<string, ExerciseDetail>; error?: Error; retry: () => void } {
  const [state, setState] = useState<{ library?: Map<string, ExerciseDetail>; error?: Error }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    loadLibrary().then(
      (library) => !cancelled && setState({ library }),
      (error: Error) => !cancelled && setState({ error }),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}

/** Library + your custom exercises, by id; undefined while loading. */
export function useAllExercises() {
  const { library, error, retry } = useLibrary()
  const customs = useLiveQuery(() => db.customExercises.toArray(), [])
  const all = useMemo(
    () =>
      library && customs
        ? new Map([...library, ...customs.map((c) => [c.id, c] as const)])
        : undefined,
    [library, customs],
  )
  return { exercises: all, error, retry }
}

const UNKNOWN: Omit<ExerciseSummary, 'id'> = {
  name: 'Unknown exercise',
  equipment: null,
  category: null,
  level: null,
  mechanic: null,
  force: null,
  is_custom: false,
  primary_muscles: [],
  secondary_muscles: [],
  image_urls: [],
}

export type ExerciseLookup = (id: ExerciseId) => ExerciseSummary

/** id → exercise (never throws: an unknown id gets a placeholder); undefined while loading. */
export function useExerciseLookup(): ExerciseLookup | undefined {
  const { exercises } = useAllExercises()
  return useMemo(
    () =>
      exercises &&
      ((id: ExerciseId) => {
        const e = exercises.get(id)
        return e ? toSummary(e) : { ...UNKNOWN, id }
      }),
    [exercises],
  )
}

/** Search results (all of them; screens show them a page at a time). */
export function useExerciseSearch(search: ExerciseSearch) {
  const { exercises, error, retry } = useAllExercises()
  const { q, muscle, equipment } = search
  const data = useMemo(
    () => exercises && searchExercises(exercises.values(), { q, muscle, equipment }),
    [exercises, q, muscle, equipment],
  )
  return { data, isPending: !data && !error, isError: Boolean(error), retry }
}

export function useExerciseFilters(): { data: ExerciseFilters | undefined } {
  const { exercises } = useAllExercises()
  return { data: useMemo(() => exercises && filterValues(exercises.values()), [exercises]) }
}

/** One exercise; data is null when it doesn't exist. */
export function useExercise(id: ExerciseId) {
  const { exercises, error, retry } = useAllExercises()
  const data = exercises ? (exercises.get(id) ?? null) : undefined
  return { data, isPending: data === undefined && !error, isError: Boolean(error), retry }
}
