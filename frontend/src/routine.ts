import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, getStoredRoutine } from './data/db'
import { hydrateRoutine } from './data/routine'
import type { Routine } from './data/types'
import { useExerciseLookup } from './exercises'

export { deleteRoutine, saveRoutine } from './data/routine'

/** Your routine (null if you train without one), including which day is up next. */
export function useRoutine(): { data: Routine | null | undefined; isPending: boolean } {
  const lookup = useExerciseLookup()
  const stored = useLiveQuery(async () => {
    const routine = await getStoredRoutine()
    return routine ? { routine, workouts: await db.workouts.toArray() } : null
  }, [])
  const data = useMemo(
    () =>
      stored === undefined || !lookup
        ? undefined
        : stored && hydrateRoutine(stored.routine, stored.workouts, lookup),
    [stored, lookup],
  )
  return { data, isPending: data === undefined }
}
