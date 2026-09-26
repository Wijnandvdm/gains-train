import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAY2_ROUTINE, seedDevice, workout } from '../test/device'
import { renderApp } from '../test/utils'

// Finished rides: stations in the weeks of 27 Jul – 24 Aug (the 17 Aug week with a bonus
// ride), a short week of 31 Aug (saved by a ticket), a station on 7 Sep, then 2 rides so far
// in the week of 14 Sep.
const DAYS = [
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-03',
  '2026-08-04',
  '2026-08-07',
  '2026-08-10',
  '2026-08-15',
  '2026-08-16',
  '2026-08-17',
  '2026-08-20',
  '2026-08-22',
  '2026-08-23',
  '2026-08-24',
  '2026-08-28',
  '2026-08-30',
  '2026-08-31',
  '2026-09-02',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-14',
  '2026-09-15',
]
const rides = (days: string[]) => days.map((d, i) => workout({ id: `ride-${i}`, performed_on: d }))

function today(date: Date) {
  vi.setSystemTime(date)
}

const card = () => screen.findByRole('region', { name: 'The Gains Line' })

describe('the Gains Line', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('asks whether you can make it to the next station', async () => {
    today(new Date(2026, 8, 17, 12)) // Thursday
    await seedDevice({ routine: DAY2_ROUTINE, workouts: rides(DAYS) })
    renderApp('/workout')

    const line = await card()
    expect(within(line).getByText('Next station')).toBeVisible()
    expect(within(line).getByRole('heading', { name: 'PR Central' })).toBeVisible()
    expect(within(line).getByRole('img', { name: '2 of 3 rides this week' })).toBeVisible()
    expect(within(line).getByText('1 more ride by Sunday keeps your streak going.')).toBeVisible()
    expect(within(line).getByText('6 stations in a row')).toBeVisible()
    expect(within(line).getByText(/1 ticket · next at 8/)).toBeVisible()
  })

  it('celebrates reaching the station', async () => {
    today(new Date(2026, 8, 17, 20))
    await seedDevice({ workouts: rides([...DAYS, '2026-09-17']) })
    renderApp('/workout')

    const line = await card()
    expect(within(line).getByRole('heading', { name: 'PR Central ✓' })).toBeVisible()
    expect(
      within(line).getByText('7 stations in a row! Another ride this week earns a ticket.'),
    ).toBeVisible()
  })

  it('says when a ticket saved your streak', async () => {
    today(new Date(2026, 8, 8, 12)) // the Tuesday after the short week
    await seedDevice({ workouts: rides(DAYS.filter((d) => d < '2026-09-08')) })
    renderApp('/workout')

    const line = await card()
    expect(
      within(line).getByText(/Last week you rode 2 times\. Your ticket got you through/),
    ).toHaveTextContent('so the streak lives on: 5 stations.')
    expect(within(line).getByText('2 more rides by Sunday keep your streak going.')).toBeVisible()
  })

  it('starts a new line after a short week without tickets', async () => {
    today(new Date(2026, 8, 17, 12))
    await seedDevice({
      settings: { weekly_target: 2 },
      workouts: rides(['2026-09-01', '2026-09-02', '2026-09-08']),
    })
    renderApp('/workout')

    const line = await card()
    expect(within(line).getByText('Last week fell short, so a new line starts here.')).toBeVisible()
    expect(within(line).getByText('2 more rides by Sunday reach your first station.')).toBeVisible()
    expect(within(line).getByRole('heading', { name: 'Warm-Up Halt' })).toBeVisible()
  })
})
