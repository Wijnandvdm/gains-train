import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { RoutineOut, WorkoutSummary } from '../api/schema'
import { formatDay } from '../lib/format'
import { ME, mockApi, renderApp } from '../test/utils'

const ROUTINE: RoutineOut = {
  id: 'r',
  next_day_id: 'd1',
  days: [
    { id: 'd1', position: 1, name: 'Day1 · Legs', exercises: [] },
    { id: 'd2', position: 2, name: 'Day2 · Back', exercises: [] },
  ],
}

const ride = (id: string, performed_on: string, routine_day_id: string | null, name: string) =>
  ({
    id,
    name,
    routine_day_id,
    performed_on,
    status: 'completed',
    started_at: null,
    ended_at: null,
    exercise_names: ['Hack Squat'],
    set_count: 9,
    volume_kg: 5000,
  }) satisfies WorkoutSummary

const WORKOUTS = [
  ride('aug', '2026-08-31', 'd2', 'Day2 · Back'),
  ride('legs', '2026-09-14', 'd1', 'Day1 · Legs'),
  ride('back', '2026-09-15', 'd2', 'Day2 · Back'),
  ride('extra', '2026-09-15', null, 'Cardio'),
]

/** The API with a working date-range filter (newest first, like the real one). */
function api() {
  return mockApi({
    'GET /api/me': () => ME,
    'GET /api/routine': () => ROUTINE,
    'GET /api/workouts': (url) => {
      const from = url.searchParams.get('performed_from') ?? ''
      const to = url.searchParams.get('performed_to') ?? '9999'
      const items = WORKOUTS.filter((w) => w.performed_on >= from && w.performed_on <= to)
      return { items: items.reverse(), total: items.length, limit: 100, offset: 0 }
    },
  })
}

const day = (iso: string) => screen.getByRole('button', { name: new RegExp(`^${formatDay(iso)}`) })

describe('calendar history', () => {
  it('shows the month with coloured rides, a legend and totals', async () => {
    const requests = api()
    renderApp('/history?month=2026-09')

    expect(await screen.findByRole('heading', { name: /september 2026/i })).toBeVisible()
    const month = requests.findLast((u) => u.pathname === '/api/workouts')!
    expect(month.searchParams.get('performed_from')).toBe('2026-09-01')
    expect(month.searchParams.get('performed_to')).toBe('2026-09-30')
    expect(await screen.findByText('3 rides · 27 sets · 15,000 kg')).toBeVisible()

    // Each day's button names its workouts (colour is never the only cue).
    expect(day('2026-09-15')).toHaveAccessibleName(
      `${formatDay('2026-09-15')}: Day2 · Back, Cardio`,
    )
    expect(day('2026-09-15').querySelectorAll('span > span')).toHaveLength(2) // two dots
    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(within(legend).getByText('Day1 · Legs')).toBeVisible()
    expect(within(legend).getByText('Other')).toBeVisible()

    // The latest ride day is selected, with its workouts below.
    expect(day('2026-09-15')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: /Cardio/ })).toHaveAttribute('href', '/history/extra')
  })

  it('selects days and moves between months', async () => {
    api()
    const user = userEvent.setup()
    const router = renderApp('/history?month=2026-09')

    await user.click(await screen.findByRole('button', { name: /Day1 · Legs$/ }))
    expect(router.state.location.search).toBe('?month=2026-09&day=2026-09-14')
    expect(screen.getByRole('link', { name: /Day1 · Legs/ })).toHaveAttribute(
      'href',
      '/history/legs',
    )

    await user.click(day('2026-09-13'))
    expect(screen.getByText(/Rest day/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByRole('heading', { name: /august 2026/i })).toBeVisible()
    expect(await screen.findByText('1 ride · 9 sets · 5,000 kg')).toBeVisible()
    expect(router.state.location.search).toBe('?month=2026-08')
  })

  it('opens on a specific day (e.g. coming back from a workout)', async () => {
    api()
    renderApp('/history?month=2026-09&day=2026-09-14')
    expect(await screen.findByRole('link', { name: /Day1 · Legs/ })).toBeVisible()
    expect(day('2026-09-14')).toHaveAttribute('aria-pressed', 'true')
  })
})
