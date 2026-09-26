import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatDay } from '../lib/format'
import { LAST_DAY2, loggedSets, PULLDOWN, ROW, seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

const seed = () => seedDevice({ workouts: [LAST_DAY2] })

describe('live workout', () => {
  it('repeats a recent workout, logs sets from last time, rests, and finishes', async () => {
    await seed()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/workout')

    // Start from the Day2 template: its exercises are added automatically.
    await user.click(await screen.findByRole('button', { name: /Day2 · Back & Triceps/ }))
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    expect(await within(block).findByText(`Last time: ${formatDay('2026-09-15')}`)).toBeVisible()

    // A new set shows last time's numbers as hints…
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    const weight = await within(block).findByLabelText('Set 1 weight (kg)')
    expect(weight).toHaveAttribute('placeholder', '80')
    expect(within(block).getByLabelText('Set 1 reps')).toHaveAttribute('placeholder', '12')

    // …and ticking the empty row logs exactly those, then starts the rest timer.
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    await waitFor(() =>
      expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
    expect(screen.getByRole('timer', { name: 'Rest timer' })).toHaveTextContent('1:30')

    // Second set: copies the row above; change the reps and tick.
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    const reps2 = await within(block).findByLabelText('Set 2 reps')
    await user.clear(reps2)
    await user.type(reps2, '11')
    await user.click(within(block).getByRole('button', { name: 'Set 2 done' }))
    await waitFor(async () =>
      expect(await loggedSets('in_progress')).toEqual([
        `${ROW.id}: 80×12 ✓`, // ticked with last time's numbers
        `${ROW.id}: 80×11 ✓`, // copied from the row above, reps edited
      ]),
    )

    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(await screen.findByText(/Workout saved/)).toBeVisible()
    expect(await loggedSets('completed')).toEqual([`${ROW.id}: 80×12 ✓`, `${ROW.id}: 80×11 ✓`])
  })

  it('keeps everything on the device, also after closing the app', async () => {
    await seed()
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Wide-Grip Lat Pulldown/ }))
    const block = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '85')
    await user.type(within(block).getByLabelText('Set 1 reps'), '10')
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    await waitFor(async () =>
      expect(await loggedSets('in_progress')).toEqual([`${PULLDOWN.id}: 85×10 ✓`]),
    )

    // Close the app and open it again: the workout is still in progress, set and all.
    cleanup()
    renderApp('/workout')
    const again = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    expect(within(again).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(again).getByLabelText('Set 1 weight (kg)')).toHaveValue('85')
  })

  it('asks for reps when ticking a set with nothing to go on', async () => {
    await seed()
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Wide-Grip Lat Pulldown/ }))
    const block = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    expect(within(block).getByText('First time')).toBeVisible()
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.click(await within(block).findByRole('button', { name: 'Set 1 done' }))

    expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(block).getByLabelText('Set 1 reps')).toHaveClass('border-red-500!')
  })
})

describe('personal records', () => {
  it('marks a set that beats your records as a PR, right when it is ticked', async () => {
    await seed() // last time: 80 × 12, so the best e1RM is 112
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: /Day2 · Back & Triceps/ }))
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '82.5')
    // 82.5 × 12: heavier than 80 kg, and e1RM 115.5 beats 112.
    await user.type(within(block).getByLabelText('Set 1 reps'), '12')
    expect(within(block).queryByRole('img', { name: /Personal record/ })).toBeNull()

    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    expect(
      await within(block).findByRole('img', {
        name: 'Personal record: Heaviest weight, Best estimated 1RM',
      }),
    ).toHaveTextContent('🏆 PR')

    // Same again: it only ties the set before it, so no second badge.
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.click(await within(block).findByRole('button', { name: 'Set 2 done' }))
    expect(within(block).getAllByRole('img', { name: /Personal record/ })).toHaveLength(1)
  })
})

describe('history', () => {
  it('shows a past workout set by set', async () => {
    await seed()
    renderApp('/history/last-day2')
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    expect(within(block).getByText('80 × 12')).toBeVisible()
    expect(within(block).getByText('80 × 10')).toBeVisible()
    // "Back" returns to that day in the calendar.
    const historyLinks = screen.getAllByRole('link', { name: 'History' }) // back link + tab
    expect(historyLinks.map((l) => l.getAttribute('href'))).toContain(
      '/history?month=2026-09&day=2026-09-15',
    )
  })
})
