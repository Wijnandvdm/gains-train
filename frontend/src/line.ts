import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './data/db'
import { gainsLine, type GainsLine } from './data/line'
import { localDateString } from './lib/format'
import { useSettings } from './settings'

/** Your weekly streak (stations, tickets), live from your finished workouts. */
export function useGainsLine(): GainsLine | undefined {
  const settings = useSettings()
  const days = useLiveQuery(
    async () =>
      (await db.workouts.where('status').equals('completed').toArray()).map((w) => w.performed_on),
    [],
  )
  return useMemo(
    () =>
      days && settings
        ? gainsLine(days, settings.weekly_target, localDateString(), new Set(settings.depot_weeks))
        : undefined,
    [days, settings],
  )
}
