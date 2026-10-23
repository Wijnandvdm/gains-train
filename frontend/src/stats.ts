import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './data/db'
import { exerciseStats, overview } from './data/stats'
import type { ExerciseOverview, ExerciseStats } from './data/types'
import { useWeightCount } from './data/dumbbells'
import { useExerciseLookup } from './exercises'

/** Records and per-session progress for one exercise (finished workouts only). */
export function useExerciseStats(exerciseId: string): {
  data: ExerciseStats | undefined
  isPending: boolean
} {
  const count = useWeightCount()
  const data = useLiveQuery(
    async () =>
      count &&
      exerciseStats(
        await db.workouts.where('exercise_ids').equals(exerciseId).toArray(),
        exerciseId,
        count,
      ),
    [exerciseId, count],
  )
  return { data, isPending: data === undefined }
}

/** Every exercise you've done: the dashboard. */
export function useStatsOverview(): {
  data: ExerciseOverview[] | undefined
  isPending: boolean
} {
  const lookup = useExerciseLookup()
  const count = useWeightCount()
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const data = useMemo(
    () => (workouts && lookup && count ? overview(workouts, lookup, count) : undefined),
    [workouts, lookup, count],
  )
  return { data, isPending: data === undefined }
}
