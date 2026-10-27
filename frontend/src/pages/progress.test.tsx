import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDay, formatShortDay } from '../lib/format'
import { libraryExercise } from '../test/library'
import { PULLDOWN, ROW, seedDevice, set, workout } from '../test/device'
import { renderApp } from '../test/utils'

const session = (id: string, performed_on: string, sets: [number, number][]) =>
  workout({ id, performed_on }, [
    [PULLDOWN.id, sets.map(([kg, reps], i) => set(`${id}-${i}`, `${id}-we`, i + 1, kg, reps))],
  ])

// Best: 90 × 12 on 7 Sep (e1RM 126). Rep records: 90 × 12 and 80 × 14.
const WORKOUTS = [
  session('a', '2026-07-22', [
    [80, 14],
    [80, 10],
    [80, 10],
  ]),
  session('b', '2026-09-07', [
    [90, 12],
    [85, 10],
    [85, 10],
  ]),
  session('c', '2026-09-15', [
    [85, 10],
    [85, 10],
    [85, 10],
  ]),
]

describe('progress', () => {
  // A fixed "today" just after the sessions, so the time filter doesn't depend on the real date
  // (only the clock is faked; timers run as usual).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 20, 12))
  })
  afterEach(() => vi.useRealTimers())

  it('lists every exercise like the old dashboard', async () => {
    await seedDevice({ workouts: WORKOUTS })
    renderApp('/progress')

    const card = (await screen.findByText('Wide-Grip Lat Pulldown')).closest('a')!
    expect(card).toHaveAttribute('href', `/exercises/${PULLDOWN.id}`)
    expect(within(card).getByText('85 kg')).toBeVisible() // last session
    expect(within(card).getByText('90 kg')).toBeVisible() // max
    expect(within(card).getByText('126 kg')).toBeVisible() // e1RM
    // 8 050 kg over 9 sets.
    expect(within(card).getByText(/^9 sets · 894 kg per set$/)).toBeVisible()
  })

  it('shows records, rep records and the chart data on an exercise page', async () => {
    await seedDevice({ workouts: WORKOUTS })
    renderApp(`/exercises/${PULLDOWN.id}`)

    const progress = await screen.findByRole('region', { name: 'Your progress' })
    expect(await within(progress).findByText('Heaviest')).toBeVisible()
    expect(within(progress).getByText(`× 12 · ${formatShortDay('2026-09-07')}`)).toBeVisible()
    expect(within(progress).getByText('Rep records')).toBeVisible()
    // Best session: the best volume per set (7 Sep), not the biggest total.
    expect(within(progress).getByText(`per set · ${formatShortDay('2026-09-07')}`)).toBeVisible()
    expect(within(progress).getByRole('cell', { name: '80 kg' })).toBeVisible()
    expect(within(progress).getByRole('cell', { name: '14' })).toBeVisible()

    // The chart's numbers are also available as a table; it follows the chosen metric.
    await userEvent.click(await within(progress).findByText('Show as table')) // chart loads lazily
    // It opens on volume per set: 7 Sep's 2 780 kg over 3 sets.
    expect(within(progress).getByRole('columnheader', { name: 'Volume per set' })).toBeVisible()
    expect(within(progress).getByRole('cell', { name: '927 kg' })).toBeVisible()
    await userEvent.click(within(progress).getByRole('button', { name: 'Estimated 1RM' }))
    expect(within(progress).getByRole('cell', { name: '126 kg' })).toBeVisible()
    await userEvent.click(within(progress).getByRole('button', { name: 'Top weight' }))
    expect(within(progress).getByRole('columnheader', { name: 'Top weight' })).toBeVisible()
    // Estimated 1RM comes last among the metrics.
    expect(
      within(within(progress).getByRole('group', { name: 'Chart metric' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Volume per set', 'Top weight', 'Estimated 1RM'])
  })

  it('takes you from a row in the table to that workout', async () => {
    await seedDevice({ workouts: WORKOUTS })
    const user = userEvent.setup()
    const router = renderApp(`/exercises/${PULLDOWN.id}`)

    const progress = await screen.findByRole('region', { name: 'Your progress' })
    await user.click(await within(progress).findByText('Show as table'))
    // Tap anywhere on 7 Sep's row.
    await user.click(within(progress).getByRole('cell', { name: '927 kg' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/history/b'))
    expect(await screen.findByText('90 × 12')).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/exercises/${PULLDOWN.id}`))
  })

  it('takes you from a rep record to the workout it was set in', async () => {
    await seedDevice({ workouts: WORKOUTS })
    const user = userEvent.setup()
    const router = renderApp(`/exercises/${PULLDOWN.id}`)

    const progress = await screen.findByRole('region', { name: 'Your progress' })
    // 80 kg × 14 was set on 22 Jul (workout a).
    await user.click(await within(progress).findByRole('cell', { name: '14' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/history/a'))
    expect(await screen.findByText('80 × 14')).toBeVisible()
  })

  it('filters the chart by time, once you have the data for it', async () => {
    vi.setSystemTime(new Date(2026, 9, 26, 12)) // 21 months after the first session
    await seedDevice({
      workouts: [
        session('old', '2025-01-10', [[60, 10]]),
        session('aug', '2026-08-01', [[80, 10]]),
        session('sep', '2026-09-07', [[90, 10]]),
      ],
    })
    const user = userEvent.setup()
    renderApp(`/exercises/${PULLDOWN.id}`)

    const progress = await screen.findByRole('region', { name: 'Your progress' })
    await user.click(await within(progress).findByText('Show as table'))
    const range = within(progress).getByRole('group', { name: 'Time range' })
    // 21 months of data: no "2 years" yet. It opens on the last year.
    expect(
      within(range)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['3 months', '1 year', 'All'])
    expect(within(range).getByRole('button', { name: '1 year' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // The chart's own table (the rep records further down have dates too).
    const table = within(progress).getByText('Show as table').closest('details')!
    const dates = () =>
      within(table)
        .getAllByRole('link')
        .map((l) => l.textContent)
    expect(dates()).toEqual([formatDay('2026-09-07'), formatDay('2026-08-01')])

    await user.click(within(range).getByRole('button', { name: 'All' }))
    expect(dates()).toHaveLength(3)
    // Records stay all-time: the heaviest is 90 kg either way.
    expect(within(progress).getByText('Heaviest')).toBeVisible()
  })

  it('has no time filter for a short history', async () => {
    await seedDevice({ workouts: WORKOUTS.slice(1) }) // 7 and 15 Sep
    const user = userEvent.setup()
    renderApp(`/exercises/${PULLDOWN.id}`)
    const progress = await screen.findByRole('region', { name: 'Your progress' })
    await user.click(await within(progress).findByText('Show as table'))
    expect(within(progress).queryByRole('group', { name: 'Time range' })).toBeNull()
  })

  it('invites you to log it when there is no data yet', async () => {
    await seedDevice()
    renderApp(`/exercises/${PULLDOWN.id}`)
    expect(await screen.findByText(/You haven't logged this exercise yet/)).toBeVisible()
  })

  it('groups exercises by routine day, opening on the day that is up next', async () => {
    const CURL = libraryExercise('Hammer_Curls', 'Hammer Curls', { primary_muscles: ['biceps'] })
    const one = (id: string, exerciseId: string, day: string) =>
      workout({ id, performed_on: day }, [[exerciseId, [set(`${id}-s`, `${id}-we`, 1, 50, 10)]]])
    await seedDevice({
      library: [ROW, PULLDOWN, CURL],
      routine: {
        days: [
          { id: 'd1', name: 'Day1 · Back', exercises: [{ exercise_id: ROW.id, sets: 3 }] },
          { id: 'd2', name: 'Day2 · Lats', exercises: [{ exercise_id: PULLDOWN.id, sets: 3 }] },
        ],
      },
      workouts: [
        one('a', ROW.id, '2026-09-01'),
        one('b', PULLDOWN.id, '2026-09-02'),
        one('c', CURL.id, '2026-09-03'),
      ],
    })
    const user = userEvent.setup()
    const router = renderApp('/progress')

    const names = () =>
      screen
        .getAllByRole('link')
        .map((l) => l.textContent)
        .filter((t) => t?.match(/Rows|Pulldown|Curls/))
    const chip = (name: string) => screen.findByRole('button', { name })
    expect(await chip('Day1 · Back')).toHaveAttribute('aria-pressed', 'true') // up next
    expect(names()).toEqual([expect.stringContaining('Seated Cable Rows')])

    await user.click(await chip('Day2 · Lats'))
    expect(names()).toEqual([expect.stringContaining('Wide-Grip Lat Pulldown')])
    expect(router.state.location.search).toBe('?day=d2')

    await user.click(await chip('Other')) // not in the routine
    expect(names()).toEqual([expect.stringContaining('Hammer Curls')])

    await user.click(await chip('All'))
    expect(names()).toHaveLength(3)
  })
})
