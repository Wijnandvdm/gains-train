import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { type Backup, BACKUP_FORMAT, BACKUP_VERSION } from '../data/backup'
import { db } from '../data/db'
import { DAY2_ROUTINE, LAST_DAY2, seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

const SHEET = [
  'Date,Day,Exercise,Set,Weight (kg),Reps,Muscle Group,Notes,',
  '2026-09-14,Day1,Seated Cable Rows,1,80,12,Back,,',
  '2026-09-14,Day1,Seated Cable Rows,2,80,10,Back,,',
  '2026-09-15,Day2,Wide-Grip Lat Pulldown,1,85,10,Lats,,',
].join('\n')

const csv = (text: string) => new File([text], 'Log.csv', { type: 'text/csv' })

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
  it('imports the old sheet, then offers its days as your split', async () => {
    await seedDevice({ setupDone: false })
    const user = userEvent.setup()
    renderApp('/workout')

    await user.upload(await screen.findByLabelText('Import my old sheet'), csv(SHEET))
    expect(await screen.findByText('Imported 2 workouts with 3 sets.')).toBeVisible()
    const split = await screen.findByRole('radio', { name: /My usual split/ })
    expect(split).toBeChecked()
    expect(split.closest('label')).toHaveTextContent('Day1 · Back → Day2 · Lats')

    await user.click(screen.getByRole('button', { name: 'All aboard! 🚂' }))
    // Day2 was last, so the rotation starts over at Day1, prefilled from the sheet.
    expect(await screen.findByRole('heading', { name: 'Day1 · Back' })).toBeVisible()
    const card = () => screen.getByRole('region', { name: 'Current set' })
    await waitFor(() => expect(within(card()).getByLabelText('kg')).toHaveValue('80'))
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

    const notABackup = new File([SHEET], 'Log.json', { type: 'application/json' })
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
