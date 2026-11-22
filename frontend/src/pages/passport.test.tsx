import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatDay, formatShortDay } from '../lib/format'
import { ROW, seedDevice, set, workout } from '../test/device'
import { renderApp } from '../test/utils'

describe('the passport', () => {
  it('shows earned stamps and the next ones on the Progress tab', async () => {
    const rides = Array.from({ length: 10 }, (_, i) =>
      workout({ id: `r${i}`, performed_on: `2026-08-${String(10 + i).padStart(2, '0')}` }, [
        [ROW.id, [set(`s${i}`, `we${i}`, 1, 100, 10)]],
      ]),
    )
    await seedDevice({ workouts: rides })
    const user = userEvent.setup()
    renderApp('/progress')

    const passport = await screen.findByRole('region', { name: 'Passport' })
    // Rides 1 and 10, and (ten days in a row) the Express stamps for 3, 5 and 7 days and the
    // Weekend express (Saturday 15 and Sunday 16 August).
    expect(within(passport).getByText('6 of 64 stamps')).toBeVisible()
    expect(
      within(passport).getByRole('img', {
        name: `Regular commuter (10 finished workouts), earned ${formatShortDay('2026-08-19')}`,
      }),
    ).toBeVisible()
    expect(
      within(passport).getByRole('img', { name: '40 t (A passenger carriage): 10 of 40' }),
    ).toBeVisible()

    await user.click(within(passport).getByRole('button', { name: 'Show all stamps' }))
    expect(within(passport).getByRole('heading', { name: 'Weight hauled' })).toBeVisible()
    expect(within(passport).getByRole('heading', { name: 'Full steam ahead' })).toBeVisible()
    expect(
      within(passport).getByRole('img', {
        name: '3 weeks (one exercise stronger every week): 0 of 3',
      }),
    ).toBeVisible()
    expect(within(passport).getByRole('heading', { name: 'Holiday specials' })).toBeVisible()
    expect(within(passport).getByRole('img', { name: 'Night train: not yet' })).toBeVisible()
    expect(
      within(passport).getByRole('img', {
        name: `7 days in a row, earned ${formatShortDay('2026-08-16')}`,
      }),
    ).toBeVisible()
    expect(within(passport).getAllByRole('img')).toHaveLength(64)
  })

  it('explains a stamp when you tap it', async () => {
    const rides = Array.from({ length: 10 }, (_, i) =>
      workout({ id: `r${i}`, performed_on: `2026-08-${String(10 + i).padStart(2, '0')}` }, [
        [ROW.id, [set(`s${i}`, `we${i}`, 1, 100, 10)]],
      ]),
    )
    await seedDevice({ workouts: rides })
    const user = userEvent.setup()
    renderApp('/progress')
    const passport = await screen.findByRole('region', { name: 'Passport' })

    await user.click(within(passport).getByRole('button', { name: /^Regular commuter/ }))
    expect(within(passport).getByRole('note')).toHaveTextContent(
      `Regular commuter: 10 finished workouts. Earned ${formatDay('2026-08-19')}.`,
    )
    // One still to earn: how far you are.
    await user.click(within(passport).getByRole('button', { name: /^40 t/ }))
    expect(within(passport).getByRole('note')).toHaveTextContent(
      /^40 t: 40 tonnes lifted in total .* as much as a passenger carriage\. So far: 10 of 40\.$/,
    )
    // Tap it again to close.
    await user.click(within(passport).getByRole('button', { name: /^40 t/ }))
    expect(within(passport).queryByRole('note')).toBeNull()
  })

  it('announces a new stamp when you finish a workout', async () => {
    await seedDevice()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Seated Cable Rows/ }))
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '80')
    await user.type(within(block).getByLabelText('Set 1 reps'), '10')
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    expect(await screen.findByText('New stamp in your passport!')).toBeVisible()
    expect(screen.getByRole('img', { name: /^Conductor in training/ })).toBeVisible()
  })
})
