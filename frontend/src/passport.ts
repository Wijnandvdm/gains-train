import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, getStoredRoutine } from './data/db'
import { type Passport, passport } from './data/passport'
import { useWeightCount } from './data/dumbbells'
import { useLibrary } from './exercises'
import { localDateString } from './lib/format'
import { useSettings } from './settings'

/** Your stamps, live from your finished workouts. */
export function usePassport(): Passport | undefined {
  const settings = useSettings()
  const { library } = useLibrary()
  const count = useWeightCount()
  const workouts = useLiveQuery(() => db.workouts.where('status').equals('completed').toArray(), [])
  // Your routine, for the Side-tracked stamp (null: none).
  const routine = useLiveQuery(getStoredRoutine, [])
  // Exercises with exercise preferences, for the "Set up just right" stamp.
  const preferences = useLiveQuery(
    async () =>
      new Set(
        (await db.machineSettings.toArray())
          .filter((m) => m.settings.length > 0)
          .map((m) => m.exercise_id),
      ),
    [],
  )
  return useMemo(
    () =>
      workouts && settings && library && count && preferences && routine !== undefined
        ? passport(
            workouts,
            {
              target: settings.weekly_target,
              depot: new Set(settings.depot_weeks),
              today: localDateString(),
            },
            new Set(library.keys()),
            count,
            {
              preferences,
              lastBackupAt: settings.last_backup_at,
              routine,
              exercises: library,
            },
          )
        : undefined,
    [workouts, settings, library, count, preferences, routine],
  )
}
