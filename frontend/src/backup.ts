import { useLiveQuery } from 'dexie-react-hooks'
import { backupDue } from './data/backup'
import { db } from './data/db'
import { useSettings } from './settings'

/** Whether to suggest making a backup now (see backupDue); false while loading. */
export function useBackupDue(): boolean {
  const settings = useSettings()
  const first = useLiveQuery(
    async () => (await db.workouts.orderBy('performed_on').first()) ?? null,
    [],
  )
  return (
    settings !== undefined &&
    first !== undefined &&
    backupDue(settings, first?.performed_on ?? null)
  )
}
