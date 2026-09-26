import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { StoredRoutine } from '../data/types'
import { formatDay } from '../lib/format'
import { ROW, seedDevice, set, workout } from '../test/device'
import { renderApp } from '../test/utils'

const ROUTINE: StoredRoutine = {
  days: [
    { id: 'd1', name: 'Day1 · Legs', exercises: [] },
    { id: 'd2', name: 'Day2 · Back', exercises: [] },
  ],
}

/** A finished ride: 3 sets of 100 kg × 10 (3 000 kg). */
const ride = (id: string, performed_on: string, routine_day_id: string | null, name: string) =>
  workout({ id, performed_on, routine_day_id, name }, [
    [ROW.id, [1, 2, 3].map((n) => set(`${id}-${n}`, `${id}-we`, n, 100, 10))],
  ])

const WORKOUTS = [
  ride('aug', '2026-08-31', 'd2', 'Day2 · Back'),
  ride('legs', '2026-09-14', 'd1', 'Day1 · Legs'),
  ride('back', '2026-09-15', 'd2', 'Day2 · Back'),
  ride('extra', '2026-09-15', null, 'Cardio'),
]

const seed = () => seedDevice({ routine: ROUTINE, workouts: WORKOUTS })

const day = (iso: string) => screen.getByRole('button', { name: new RegExp(`^${formatDay(iso)}`) })

describe('calendar history', () => {
  it('shows the month with coloured rides, a legend and totals', async () => {
    await seed()
    renderApp('/history?month=2026-09')

    expect(await screen.findByRole('heading', { name: /september 2026/i })).toBeVisible()
    expect(await screen.findByText('3 rides · 9 sets · 9 000 kg')).toBeVisible()

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
    await seed()
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
    expect(await screen.findByText('1 ride · 3 sets · 3 000 kg')).toBeVisible()
    expect(router.state.location.search).toBe('?month=2026-08')
  })

  it('opens on a specific day (e.g. coming back from a workout)', async () => {
    await seed()
    renderApp('/history?month=2026-09&day=2026-09-14')
    expect(await screen.findByRole('link', { name: /Day1 · Legs/ })).toBeVisible()
    expect(day('2026-09-14')).toHaveAttribute('aria-pressed', 'true')
  })
})
