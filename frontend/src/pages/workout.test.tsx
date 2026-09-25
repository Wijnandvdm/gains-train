import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatDay } from '../lib/format'
import { fakeBackend } from '../test/fakeBackend'
import { renderApp } from '../test/utils'

describe('live workout', () => {
  it('repeats a recent workout, logs sets from last time, rests, and finishes', async () => {
    const backend = fakeBackend()
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
    expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('timer', { name: 'Rest timer' })).toHaveTextContent('1:30')

    // Second set: copies the row above; change the reps and tick.
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    const reps2 = await within(block).findByLabelText('Set 2 reps')
    await user.clear(reps2)
    await user.type(reps2, '11')
    await user.click(within(block).getByRole('button', { name: 'Set 2 done' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible())

    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(await screen.findByText(/Workout saved/)).toBeVisible()
    await waitFor(() => expect(backend.state.writes.at(-1)).toBe('finish'))

    expect(backend.state.writes).toEqual([
      'start',
      'add Seated Cable Rows',
      'set null×null', // "+ Add set" creates an empty row…
      'set 80×12 ✓', // …ticked with last time's numbers
      'set 80×12', // second row copies the first
      'set 80×11', // reps edited (saved on blur)
      'set 80×11 ✓',
      'finish',
    ])
  })

  it('keeps logging offline and syncs when the connection returns', async () => {
    const backend = fakeBackend()
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible())

    backend.state.online = false // gym Wi-Fi drops
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Wide-Grip Lat Pulldown/ }))
    const block = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '85')
    await user.type(within(block).getByLabelText('Set 1 reps'), '10')
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))

    // Everything shows as logged, and the header says it's waiting to sync.
    expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await screen.findByText(/Offline · \d waiting/)).toBeVisible()
    expect(backend.state.writes).toEqual(['start'])

    // Leaving and coming back re-fetches the workout from the server, which doesn't have
    // the offline changes yet; they must still be shown on top.
    await user.click(screen.getByRole('link', { name: 'History' }))
    await screen.findByRole('heading', { name: 'History' })
    await user.click(screen.getByRole('link', { name: 'Workout' }))
    const again = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    expect(within(again).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    backend.state.online = true
    act(() => void window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible())
    expect(backend.state.writes).toEqual(['start', 'add Wide-Grip Lat Pulldown', 'set 85×10 ✓'])
  })

  it('asks for reps when ticking a set with nothing to go on', async () => {
    fakeBackend()
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
    fakeBackend({
      'GET /api/stats/exercises/:id': () => ({
        records: {
          heaviest: { weight_kg: 80, reps: 12, performed_on: '2026-09-15' },
          best_e1rm: { weight_kg: 80, reps: 12, performed_on: '2026-09-15' },
          best_e1rm_kg: 112,
          best_session_volume_kg: 1760,
          best_session_volume_on: '2026-09-15',
          rep_records: [{ weight_kg: 80, reps: 12, performed_on: '2026-09-15' }],
        },
        sessions: [],
      }),
    })
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
    fakeBackend()
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
