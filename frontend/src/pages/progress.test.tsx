import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { formatShortDay } from '../lib/format'
import { PULLDOWN, seedDevice, set, workout } from '../test/device'
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
  it('lists every exercise like the old dashboard', async () => {
    await seedDevice({ workouts: WORKOUTS })
    renderApp('/progress')

    const card = (await screen.findByText('Wide-Grip Lat Pulldown')).closest('a')!
    expect(card).toHaveAttribute('href', `/exercises/${PULLDOWN.id}`)
    expect(within(card).getByText('85 kg')).toBeVisible() // last session
    expect(within(card).getByText('90 kg')).toBeVisible() // max
    expect(within(card).getByText('126 kg')).toBeVisible() // e1RM
    expect(within(card).getByText(/9 sets/)).toBeVisible()
  })

  it('shows records, rep records and the chart data on an exercise page', async () => {
    await seedDevice({ workouts: WORKOUTS })
    renderApp(`/exercises/${PULLDOWN.id}`)

    const progress = await screen.findByRole('region', { name: 'Your progress' })
    expect(await within(progress).findByText('Heaviest')).toBeVisible()
    expect(within(progress).getByText(`× 12 · ${formatShortDay('2026-09-07')}`)).toBeVisible()
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
    await seedDevice()
    renderApp(`/exercises/${PULLDOWN.id}`)
    expect(await screen.findByText(/You haven't logged this exercise yet/)).toBeVisible()
  })
})
