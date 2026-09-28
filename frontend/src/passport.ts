import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './data/db'
import { type Passport, passport } from './data/passport'
import { useLibrary } from './exercises'
import { localDateString } from './lib/format'
import { useSettings } from './settings'

/** Your stamps, live from your finished workouts. */
export function usePassport(): Passport | undefined {
  const settings = useSettings()
  const { library } = useLibrary()
  const workouts = useLiveQuery(() => db.workouts.where('status').equals('completed').toArray(), [])
  return useMemo(
    () =>
      workouts && settings && library
        ? passport(
            workouts,
            {
              target: settings.weekly_target,
              depot: new Set(settings.depot_weeks),
              today: localDateString(),
            },
            new Set(library.keys()),
          )
        : undefined,
    [workouts, settings, library],
  )
}
