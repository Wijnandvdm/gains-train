import { screen, waitFor, within } from '@testing-library/react'
import { unzipSync } from 'fflate'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { type Backup, BACKUP_FORMAT, BACKUP_VERSION } from '../data/backup'
import { db, DEFAULT_SETTINGS, getSettings } from '../data/db'
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
    ...DEFAULT_SETTINGS,
    setup_completed_at: '2026-09-01T00:00:00Z',
    default_rest_seconds: 120,
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
    const hint = screen.getByText('Pick the backup file you exported earlier, like:').parentElement!
    expect(hint).toHaveTextContent(/gains-train-backup-\d{4}-\d{2}-\d{2}\.zip/)
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
    const exported = captureDownloads()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/settings')

    expect(await screen.findByText('Last backup: none yet')).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Export backup' }))
    expect(await screen.findByText('Backup made: 1 workout.')).toBeVisible()
    await waitFor(() => expect(screen.queryByText('Last backup: none yet')).toBeNull())
    const file = exported.at(-1)!
    expect(Object.keys(unzipSync(new Uint8Array(await file.arrayBuffer())))).toContain(
      'workouts.csv',
    )

    // Everything gone (a new phone), then restored from the file.
    await db.workouts.clear()
    const zip = new File([file], 'gains-train-backup-2026-09-29.zip', { type: 'application/zip' })
    await user.upload(screen.getByLabelText('Import backup'), zip)
    expect(await screen.findByText(/^Restored 1 workout from/)).toBeVisible()
    expect(await db.workouts.toArray()).toEqual([LAST_DAY2])
  })

  it('lets you choose how often to be reminded', async () => {
    await seedDevice()
    const user = userEvent.setup()
    renderApp('/settings')
    await user.selectOptions(await screen.findByLabelText('Remind me to back up'), 'Every 3 months')
    expect((await getSettings()).backup_reminder_months).toBe(3)
  })
})

describe('the backup reminder after a workout', () => {
  async function finishAWorkout() {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/workout')
    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Seated Cable Rows/ }))
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '80')
    await user.type(within(block).getByLabelText('Set 1 reps'), '10')
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    await screen.findByText(/Workout saved/)
    return user
  }

  it('asks when your last backup is half a year old; "Back up now" saves one', async () => {
    await seedDevice({
      workouts: [LAST_DAY2],
      settings: { last_backup_at: '2025-01-10T10:00:00Z' },
    })
    const exported = captureDownloads()
    const user = await finishAWorkout()

    expect(await screen.findByText('Time for a backup?')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back up now' }))
    expect(await screen.findByText(/^Backup saved/)).toBeVisible()
    expect(exported).toHaveLength(1)
    expect((await getSettings()).last_backup_at).not.toBe('2025-01-10T10:00:00Z')
  })

  it('"Not now" waits a week', async () => {
    await seedDevice({
      workouts: [LAST_DAY2],
      settings: { last_backup_at: '2025-01-10T10:00:00Z' },
    })
    const user = await finishAWorkout()
    await user.click(await screen.findByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(screen.queryByText('Time for a backup?')).toBeNull())
    expect((await getSettings()).backup_reminded_at).not.toBeNull()
  })

  it("doesn't ask after a recent backup", async () => {
    await seedDevice({
      workouts: [LAST_DAY2],
      settings: { last_backup_at: new Date().toISOString() },
    })
    await finishAWorkout()
    expect(screen.queryByText('Time for a backup?')).toBeNull()
  })
})

/** Files the app hands you as a download (the browser path of saveFile). */
function captureDownloads(): Blob[] {
  const files: Blob[] = []
  // A real URL (the app still builds URLs), with the download functions captured.
  class DownloadURL extends URL {
    static createObjectURL = (blob: Blob) => (files.push(blob), 'blob:backup')
    static revokeObjectURL = () => {}
  }
  vi.stubGlobal('URL', DownloadURL)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return files
}
