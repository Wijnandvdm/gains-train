import { useState } from 'react'
import { exportBackup } from '../data/backup'
import { formatDay } from '../lib/format'
import { useAction } from '../lib/useAction'
import { updateSettings, useSettings } from '../settings'
import { useBackupDue } from '../backup'
import { ErrorMessage } from './ErrorMessage'

/**
 * "Time for a backup?", after a workout when your last backup is old enough (Settings →
 * Backup sets how often). "Back up now" opens the share sheet; "Not now" asks again in a week.
 */
export function BackupReminder() {
  const due = useBackupDue()
  const settings = useSettings()
  const [saved, setSaved] = useState(false)
  const backingUp = useAction(async () => setSaved((await exportBackup()) !== null))
  if (saved) {
    return (
      <p role="status" className="mt-3 border-t border-brand-100 pt-3 dark:border-brand-900">
        Backup saved. See you again in a while!
      </p>
    )
  }
  if (!due && !backingUp.isPending) return null

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-brand-100 pt-3 dark:border-brand-900">
      <p>
        <strong>Time for a backup?</strong>{' '}
        {settings?.last_backup_at
          ? `Your last one is from ${formatDay(settings.last_backup_at.slice(0, 10))}.`
          : "You haven't made one yet."}{' '}
        Your workouts only live on this phone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={backingUp.isPending}
          onClick={() => void backingUp.run().catch(() => {})}
        >
          Back up now
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void updateSettings({ backup_reminded_at: new Date().toISOString() })}
        >
          Not now
        </button>
      </div>
      <ErrorMessage error={backingUp.error} />
    </div>
  )
}
