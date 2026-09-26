import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './data/db'
import { exerciseStats, overview } from './data/stats'
import type { ExerciseOverviewOut, ExerciseStats } from './data/types'
import { useExerciseLookup } from './exercises'

/** Records and per-session progress for one exercise (finished workouts only). */
export function useExerciseStats(exerciseId: string): {
  data: ExerciseStats | undefined
  isPending: boolean
} {
  const data = useLiveQuery(
    async () =>
      exerciseStats(
        await db.workouts.where('exercise_ids').equals(exerciseId).toArray(),
        exerciseId,
      ),
    [exerciseId],
  )
  return { data, isPending: data === undefined }
}

/** Every exercise you've done: the dashboard. */
export function useStatsOverview(): {
  data: ExerciseOverviewOut[] | undefined
  isPending: boolean
} {
  const lookup = useExerciseLookup()
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const data = useMemo(
    () => (workouts && lookup ? overview(workouts, lookup) : undefined),
    [workouts, lookup],
  )
  return { data, isPending: data === undefined }
}
