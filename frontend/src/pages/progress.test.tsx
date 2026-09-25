import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ExerciseOverviewOut, ExerciseStats } from '../api/schema'
import { formatDay } from '../lib/format'
import { exercise, exerciseDetail, ME, mockApi, renderApp } from '../test/utils'

const PULLDOWN = exercise(11, 'Wide-Grip Lat Pulldown', { primary_muscles: ['lats'] })

const STATS: ExerciseStats = {
  records: {
    heaviest: { weight_kg: 90, reps: 12, performed_on: '2026-09-07' },
    best_e1rm: { weight_kg: 90, reps: 12, performed_on: '2026-09-07' },
    best_e1rm_kg: 126,
    best_session_volume_kg: 2890,
    best_session_volume_on: '2026-09-07',
    rep_records: [
      { weight_kg: 90, reps: 12, performed_on: '2026-09-07' },
      { weight_kg: 80, reps: 14, performed_on: '2026-07-22' },
    ],
  },
  sessions: [
    {
      workout_id: 'a',
      performed_on: '2026-07-22',
      top_weight_kg: 80,
      top_weight_reps: 10,
      best_e1rm_kg: 117.33,
      volume_kg: 2780,
      set_count: 3,
    },
    {
      workout_id: 'b',
      performed_on: '2026-09-07',
      top_weight_kg: 90,
      top_weight_reps: 12,
      best_e1rm_kg: 126,
      volume_kg: 2890,
      set_count: 3,
    },
  ],
}

describe('progress', () => {
  it('lists every exercise like the old dashboard', async () => {
    const row: ExerciseOverviewOut = {
      exercise: PULLDOWN,
      sets_logged: 27,
      last_performed_on: '2026-09-15',
      last_top_weight_kg: 85,
      max_weight_kg: 90,
      best_e1rm_kg: 126,
      total_volume_kg: 22500,
    }
    mockApi({ 'GET /api/me': () => ME, 'GET /api/stats/overview': () => [row] })
    renderApp('/progress')

    const card = (await screen.findByText('Wide-Grip Lat Pulldown')).closest('a')!
    expect(card).toHaveAttribute('href', '/exercises/11')
    expect(within(card).getByText('85 kg')).toBeVisible() // last session
    expect(within(card).getByText('90 kg')).toBeVisible() // max
    expect(within(card).getByText('126 kg')).toBeVisible() // e1RM
    expect(within(card).getByText(/27 sets/)).toBeVisible()
  })

  it('shows records, rep records and the chart data on an exercise page', async () => {
    mockApi({
      'GET /api/me': () => ME,
      'GET /api/exercises/:id': () => exerciseDetail(PULLDOWN),
      'GET /api/stats/exercises/:id': () => STATS,
    })
    renderApp('/exercises/11')

    const progress = await screen.findByRole('region', { name: 'Your progress' })
    expect(await within(progress).findByText('Heaviest')).toBeVisible()
    expect(within(progress).getByText(`× 12 · ${formatDay('2026-09-07')}`)).toBeVisible()
    expect(within(progress).getByText('Rep records')).toBeVisible()
    expect(within(progress).getByRole('cell', { name: '80 kg' })).toBeVisible()
    expect(within(progress).getByRole('cell', { name: '14' })).toBeVisible()

    // The chart's numbers are also available as a table; it follows the chosen metric.
    await userEvent.click(await within(progress).findByText('Show as table')) // chart loads lazily
    expect(within(progress).getByRole('cell', { name: '126 kg' })).toBeVisible()
    await userEvent.click(within(progress).getByRole('button', { name: 'Top weight' }))
    expect(within(progress).getByRole('columnheader', { name: 'Top weight' })).toBeVisible()
  })

  it('invites you to log it when there is no data yet', async () => {
    mockApi({
      'GET /api/me': () => ME,
      'GET /api/exercises/:id': () => exerciseDetail(PULLDOWN),
      'GET /api/stats/exercises/:id': () => ({ records: null, sessions: [] }),
    })
    renderApp('/exercises/11')
    expect(await screen.findByText(/You haven't logged this exercise yet/)).toBeVisible()
  })
})
