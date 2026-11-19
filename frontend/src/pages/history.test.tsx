import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  // Thursday 17 September 2026 (only the clock is faked; timers run as usual).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 17, 12))
  })
  afterEach(() => vi.useRealTimers())

  it('shows the month with rides filling up each week, and totals', async () => {
    await seed()
    renderApp('/history?month=2026-09')

    expect(await screen.findByRole('heading', { name: /september 2026/i })).toBeVisible()
    expect(await screen.findByText('3 rides · 9 sets · 9 000 kg')).toBeVisible()

    // The rings come with the Gains Line, which may load a moment later.
    await screen.findByRole('img', { name: 'Week goal reached' })
    // Each day's button names its workouts and the ride of the week (the ring isn't the only cue).
    expect(day('2026-09-15')).toHaveAccessibleName(
      `${formatDay('2026-09-15')}: Day2 · Back, Cardio: ride 3 of 3 this week`,
    )
    // Days you trained are rings that fill up with the week's rides: a third, then (two rides
    // on the 15th) the whole circle.
    const rides = (iso: string) =>
      day(iso).querySelector('[data-rides]')?.getAttribute('data-rides')
    expect(rides('2026-09-14')).toBe('1')
    expect(rides('2026-09-15')).toBe('3')
    expect(rides('2026-09-13')).toBeUndefined()
    // Three rides in the week of the 14th reach a station (the default target is 3).
    const week = day('2026-09-14').closest('tr')!
    expect(within(week).getByRole('img', { name: 'Week goal reached' })).toBeVisible()
    expect(screen.getByText('1 week in a row')).toBeVisible()

    // No legends: things explain themselves when tapped.
    expect(screen.queryByRole('list', { name: 'Week legend' })).toBeNull()

    // The latest ride day is selected, with its workouts below (and its ride of the week).
    expect(day('2026-09-15')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Ride 3 of 3 this week: week goal reached')).toBeVisible()
    expect(screen.getByRole('link', { name: /Cardio/ })).toHaveAttribute('href', '/history/extra')
  })

  it('explains a week marker or pill when you tap it', async () => {
    await seed()
    const user = userEvent.setup()
    renderApp('/history?month=2026-09')

    await user.click(await screen.findByRole('button', { name: 'Week goal reached' }))
    expect(screen.getByRole('note')).toHaveTextContent(
      'Week goal reached: 3 workouts, your goal of 3.',
    )
    await user.click(screen.getByRole('heading', { name: 'History' })) // anywhere else
    expect(screen.queryByRole('note')).toBeNull()

    await user.click(screen.getByRole('button', { name: /^0 tickets/ }))
    expect(screen.getByRole('note')).toHaveTextContent(
      /^Tickets save your streak in a week that falls short\. You earn one every 4 weeks in a row/,
    )
  })

  it('takes you from a week bubble straight to your weekly target', async () => {
    await seed()
    const user = userEvent.setup()
    const router = renderApp('/history?month=2026-09')

    await user.click(await screen.findByRole('button', { name: 'Week goal reached' }))
    expect(screen.getByRole('note')).toHaveTextContent('Want a different weekly goal?')
    await user.click(screen.getByRole('link', { name: 'Change it →' }))

    // Settings loads on first use, then the router moves on.
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
    const target = await screen.findByLabelText('Your weekly goal (workouts per week)')
    await waitFor(() => expect(target).toHaveFocus())
  })

  it('selects days and moves between months', async () => {
    await seed()
    const user = userEvent.setup()
    const router = renderApp('/history?month=2026-09')

    await user.click(await screen.findByRole('button', { name: /: Day1 · Legs:/ }))
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
