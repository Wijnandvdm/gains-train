import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDay } from '../lib/format'
import { DAY2_ROUTINE, getSettings, seedDevice, workout } from '../test/device'
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
/** The bar's two lines: what it says, and what it says next. */
const bar = (line: HTMLElement) => within(line).getByRole('button', { expanded: false })
async function openBar(user: ReturnType<typeof userEvent.setup>, line: HTMLElement) {
  await user.click(bar(line))
}

describe('the Gains Line', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('says how far you are from this week’s goal, in one slim line', async () => {
    today(new Date(2026, 8, 17, 12)) // Thursday
    await seedDevice({ routine: DAY2_ROUTINE, workouts: rides(DAYS) })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderApp('/workout')

    const line = await card()
    expect(bar(line)).toHaveTextContent(
      'Only 1 more workout to reach this week’s goal of 3!' +
        '6 weeks in a row · reach it by Sunday to keep it going',
    )
    // The details only when you ask for them, so the workout comes first.
    expect(within(line).queryByRole('img', { name: '2 of 3 workouts this week' })).toBeNull()
    await openBar(user, line)
    expect(within(line).getByRole('img', { name: '2 of 3 workouts this week' })).toBeVisible()
    expect(within(line).getByText('6 weeks in a row')).toBeVisible()
    expect(within(line).getByText(/1 ticket · next at 8/)).toBeVisible()
  })

  it('cheers when you reach the goal, and counts towards the next milestone', async () => {
    today(new Date(2026, 8, 17, 20))
    await seedDevice({ workouts: rides([...DAYS, '2026-09-17']) })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderApp('/workout')

    const line = await card()
    expect(bar(line)).toHaveTextContent(
      'This week’s goal reached!' + '7 weeks in a row · 1 more to two months',
    )
    await openBar(user, line)
    expect(within(line).getByText('Another workout this week earns a ticket.')).toBeVisible()
  })

  it('celebrates a milestone', async () => {
    today(new Date(2026, 8, 17, 12))
    await seedDevice({
      settings: { weekly_target: 1 },
      workouts: rides(['2026-09-08', '2026-09-15']),
    })
    renderApp('/workout')

    expect(bar(await card())).toHaveTextContent(
      'Two weeks in a row! 🎉' + 'Keep going for a month!',
    )
  })

  it('says when a ticket saved your streak', async () => {
    today(new Date(2026, 8, 8, 12)) // the Tuesday after the short week
    await seedDevice({ workouts: rides(DAYS.filter((d) => d < '2026-09-08')) })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderApp('/workout')

    const line = await card()
    expect(bar(line)).toHaveTextContent('2 more workouts to reach this week’s goal of 3')
    await openBar(user, line)
    expect(
      within(line).getByText(/Last week you did 2 workouts\. Your ticket got you through/),
    ).toHaveTextContent('so the streak lives on: 5 weeks.')
  })

  it('starts a new streak after a short week without tickets', async () => {
    today(new Date(2026, 8, 17, 12))
    await seedDevice({
      settings: { weekly_target: 2 },
      workouts: rides(['2026-09-01', '2026-09-02', '2026-09-08']),
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderApp('/workout')

    const line = await card()
    expect(bar(line)).toHaveTextContent(
      '2 more workouts to reach this week’s goal of 2' + 'Reach it by Sunday to start your streak',
    )
    await openBar(user, line)
    expect(
      within(line).getByText('Last week fell short, so a new streak starts here.'),
    ).toBeVisible()
  })

  /** The calendar row of the week with that day: its track pieces, and the row itself. */
  async function calendarWeek(day: string) {
    const button = await screen.findByRole('button', {
      name: new RegExp(`^${formatDay(day)}(:|$)`),
    })
    const row = button.closest('tr')!
    const tracks = [...row.querySelectorAll<HTMLElement>('[data-track]')].map(
      (t) => t.dataset.track,
    )
    return { row, tracks }
  }

  it('draws the line down the calendar, station by station', async () => {
    today(new Date(2026, 8, 17, 12))
    await seedDevice({ workouts: rides(DAYS) })
    renderApp('/history?month=2026-09')
    await screen.findAllByRole('img', { name: 'Week goal reached' }) // the line has loaded

    // The week of 31 Aug: a ticket keeps the line going.
    expect((await calendarWeek('2026-09-01')).tracks).toEqual(['above', 'below'])
    const station = await calendarWeek('2026-09-07')
    expect(station.tracks).toEqual(['above', 'below'])
    expect(within(station.row).getByRole('img', { name: 'Week goal reached' })).toBeVisible()
    // This week: the train is on its way, the line doesn't go on yet.
    expect((await calendarWeek('2026-09-14')).tracks).toEqual(['above'])
    expect((await calendarWeek('2026-09-21')).tracks).toEqual([])
  })

  it('breaks the line after a missed week', async () => {
    today(new Date(2026, 8, 17, 12))
    await seedDevice({
      settings: { weekly_target: 2 },
      workouts: rides(['2026-09-01', '2026-09-02', '2026-09-14', '2026-09-15']),
    })
    renderApp('/history?month=2026-09')
    await screen.findAllByRole('img', { name: 'Week goal reached' }) // the line has loaded

    // A station, but the week after was missed.
    expect((await calendarWeek('2026-09-01')).tracks).toEqual([])
    const missed = await calendarWeek('2026-09-07')
    expect(within(missed.row).getByRole('img', { name: 'Missed' })).toBeVisible()
    expect(missed.tracks).toEqual([])
    // A new line starts here.
    expect((await calendarWeek('2026-09-14')).tracks).toEqual([])
  })

  describe('the depot', () => {
    it('parks the train from the card, and leaves again', async () => {
      today(new Date(2026, 8, 17, 12))
      await seedDevice({ workouts: rides(DAYS) })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp('/workout')

      const line = await card()
      await openBar(user, line)
      await user.click(within(line).getByRole('button', { name: /Going away\? Park in the depot/ }))
      await user.click(within(line).getByRole('button', { name: '2 weeks' }))
      const summary = within(line).getByRole('button', { expanded: true })
      await waitFor(() =>
        expect(summary).toHaveTextContent(
          `In the depot until ${formatDay('2026-09-27')}` + 'Your streak of 6 weeks waits for you',
        ),
      )
      expect((await getSettings()).depot_weeks).toEqual(['2026-09-14', '2026-09-21'])

      await user.click(within(line).getByRole('button', { name: 'Leave the depot' }))
      await waitFor(() => expect(summary).toHaveTextContent(/^Only 1 more workout/))
      expect((await getSettings()).depot_weeks).toEqual([])
    })

    it('parks last week afterwards, giving the ticket back', async () => {
      today(new Date(2026, 8, 8, 12))
      await seedDevice({ workouts: rides(DAYS.filter((d) => d < '2026-09-08')) })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp('/workout')

      const line = await card()
      await openBar(user, line)
      expect(within(line).getByText(/1 ticket/)).toBeVisible()
      await user.click(
        within(line).getByRole('button', { name: 'Were you away? Park it in the depot' }),
      )
      await waitFor(() =>
        expect(within(line).queryByText(/Your ticket got you through/)).toBeNull(),
      )
      expect(within(line).getByText(/^2 tickets/)).toBeVisible()
      expect((await getSettings()).depot_weeks).toEqual(['2026-08-31'])
    })

    it('parks from Settings too', async () => {
      today(new Date(2026, 8, 17, 12))
      await seedDevice({ workouts: rides(DAYS) })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp('/settings')

      await user.click(await screen.findByRole('button', { name: '1 week' }))
      expect(await screen.findByText(`Parked until ${formatDay('2026-09-20')}.`)).toBeVisible()
    })
  })
})
