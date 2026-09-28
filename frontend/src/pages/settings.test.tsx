import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { type Backup, BACKUP_FORMAT, BACKUP_VERSION } from '../data/backup'
import { db } from '../data/db'
import { DAY2_ROUTINE, LAST_DAY2, seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

const BACKUP: Backup = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exported_at: '2026-09-20T10:00:00Z',
  workouts: [LAST_DAY2],
  custom_exercises: [],
  rest_prefs: [],
  routine: DAY2_ROUTINE,
  settings: {
    setup_completed_at: '2026-09-01T00:00:00Z',
    rest_timer_enabled: true,
    default_rest_seconds: 120,
    weekly_target: 3,
    depot_weeks: [],
  },
}

const json = (data: unknown) =>
  new File([JSON.stringify(data)], 'gains-train-backup-2026-09-20.json', {
    type: 'application/json',
  })

describe('first open on a new phone', () => {
  it('shows which file to pick', async () => {
    await seedDevice({ setupDone: false })
    renderApp('/setup')
    expect(
      await screen.findByText('Pick the backup file you exported earlier, like:'),
    ).toBeVisible()
    expect(screen.getByText(/^gains-train-backup-\d{4}-\d{2}-\d{2}\.json$/)).toBeVisible()
  })

  it('restores a backup and goes straight to your workout', async () => {
    await seedDevice({ setupDone: false })
    const user = userEvent.setup()
    renderApp('/workout')

    await user.upload(await screen.findByLabelText('Restore a backup'), json(BACKUP))
    expect(await screen.findByText('Next stop')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Day2 · Back & Triceps' })).toBeVisible()
    expect(await db.workouts.count()).toBe(1)
  })

  it('explains what is wrong with a file that is not a backup', async () => {
    await seedDevice({ setupDone: false })
    const user = userEvent.setup()
    renderApp('/setup')

    const notABackup = new File(['Date,Day,Exercise'], 'Log.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText('Restore a backup'), notABackup)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This isn't a gains-train backup file.",
    )
  })
})

describe('settings', () => {
  it('exports a backup file that restores everything', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2], restPrefs: { x: 60 } })
    let exported: Blob | undefined
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => ((exported = blob), 'blob:backup'),
      revokeObjectURL: () => {},
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/settings')

    await user.click(await screen.findByRole('button', { name: 'Export backup' }))
    expect(await screen.findByText('Backup made: 1 workout.')).toBeVisible()
    const backup = JSON.parse(await exported!.text()) as Backup
    expect(backup).toMatchObject({ workouts: [LAST_DAY2], routine: DAY2_ROUTINE })
    expect(backup.rest_prefs).toEqual([{ exercise_id: 'x', rest_seconds: 60 }])

    // Everything gone (a new phone), then restored from the file.
    await db.workouts.clear()
    await user.upload(screen.getByLabelText('Import backup'), json(backup))
    expect(await screen.findByText(/^Restored 1 workout from/)).toBeVisible()
    expect(await db.workouts.toArray()).toEqual([LAST_DAY2])
  })
})
