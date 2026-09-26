import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import {
  DAY2_ROUTINE,
  getSettings,
  getStoredRoutine,
  LAST_DAY2,
  loggedSets,
  PULLDOWN,
  ROW,
  seedDevice,
} from '../test/device'
import { renderApp } from '../test/utils'

const card = () => screen.getByRole('region', { name: 'Current set' })

/** Waits until the focus card shows this set (last time's numbers load asynchronously). */
async function expectCard(exercise: string, set: string, kg: string, reps: string) {
  await waitFor(() => {
    expect(within(card()).getByText(exercise)).toBeVisible()
    expect(within(card()).getByText(new RegExp(`^Set ${set}`))).toBeVisible()
    expect(within(card()).getByLabelText('kg')).toHaveValue(kg)
    expect(within(card()).getByLabelText('reps')).toHaveValue(reps)
  })
}

describe('minimal clicks (routine)', () => {
  it('opens on the next day, prefilled from last time: one tap per set', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/workout')

    // Nothing to start or pick: the day is ready, set 1 prefilled with last time's 80 × 12.
    expect(await screen.findByText('Next stop')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Day2 · Back & Triceps' })).toBeVisible()
    await expectCard('Seated Cable Rows', '1 of 3', '80', '12')
    expect(await db.workouts.count()).toBe(1) // just opening the app saves nothing

    // Tap 1: starts the workout and logs set 1. The card moves on to last time's set 2.
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))
    await expectCard('Seated Cable Rows', '2 of 3', '80', '10')
    expect(screen.getByRole('timer', { name: 'Rest timer' })).toBeVisible()

    // Tap 2, then tap 3 (last time had only 2 sets: set 3 repeats today's set 2).
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))
    await expectCard('Seated Cable Rows', '3 of 3', '80', '10')
    // The train has moved 2 of 4 planned sets down the line, with a cheer on the way.
    expect(screen.getByRole('progressbar', { name: 'Workout progress' })).toHaveAttribute(
      'aria-valuetext',
      '2 of 4 sets',
    )
    expect(screen.getByText('Full steam ahead!')).toBeVisible()
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))

    // Next exercise, first time ever: nothing to prefill, so it waits for numbers.
    await expectCard('Wide-Grip Lat Pulldown', '1 of 1', '', '')
    expect(within(card()).getByRole('button', { name: '✓ Done' })).toBeDisabled()
    await user.type(within(card()).getByLabelText('kg'), '85')
    await user.click(within(card()).getByRole('button', { name: '+ 1 reps' }))
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))

    expect(await screen.findByText(/That's everything you planned/)).toBeVisible()
    // The table below shows what the card logged.
    const rows = screen.getByRole('region', { name: 'Seated Cable Rows' })
    expect(within(rows).getByLabelText('Set 3 reps')).toHaveValue('10')

    await user.click(screen.getByRole('button', { name: 'Finish workout' }))
    await waitFor(async () =>
      expect(await loggedSets('completed')).toEqual([
        `${ROW.id}: 80×12 ✓`,
        `${ROW.id}: 80×10 ✓`,
        `${ROW.id}: 80×10 ✓`,
        `${PULLDOWN.id}: 85×1 ✓`,
      ]),
    )
    const [done] = await db.workouts.where('status').equals('completed').toArray()
    expect(done).toMatchObject({ name: 'Day2 · Back & Triceps', routine_day_id: 'day2' })
  })

  it('can skip an exercise', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')

    await expectCard('Seated Cable Rows', '1 of 3', '80', '12')
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))
    await expectCard('Seated Cable Rows', '2 of 3', '80', '10')
    await user.click(within(card()).getByRole('button', { name: 'Skip Seated Cable Rows' }))
    await expectCard('Wide-Grip Lat Pulldown', '1 of 1', '', '')
  })
})

describe('first open', () => {
  it('asks how you train, then opens straight on your next day', async () => {
    await seedDevice({ setupDone: false, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    const router = renderApp('/workout')

    await screen.findByRole('heading', { name: "Let's lay the tracks" })
    expect(router.state.location.pathname).toBe('/setup')
    // Your history's named workouts are offered as your split.
    await user.click(await screen.findByRole('radio', { name: /My usual split/ }))
    await user.click(screen.getByRole('button', { name: '2 min' }))
    await user.click(screen.getByRole('button', { name: 'All aboard! 🚂' }))

    expect(await screen.findByText('Next stop')).toBeVisible()
    expect(router.state.location.pathname).toBe('/workout')
    expect((await getStoredRoutine())?.days.map((d) => d.name)).toEqual(['Day2 · Back & Triceps'])
    expect(await getSettings()).toMatchObject({ default_rest_seconds: 120 })
  })

  it('lets you build your own routine', async () => {
    await seedDevice({ setupDone: false, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    const router = renderApp('/workout')

    await user.click(await screen.findByRole('radio', { name: /Build my own routine/ }))
    await user.click(screen.getByRole('button', { name: 'All aboard! 🚂' }))
    await screen.findByRole('heading', { name: 'Your routine' })
    expect(router.state.location.pathname).toBe('/routine')

    const name = screen.getByLabelText('Day 1 name')
    await user.clear(name)
    await user.type(name, 'Push')
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Seated Cable Rows/ }))
    await user.click(screen.getByRole('button', { name: 'More sets of Seated Cable Rows' }))
    expect(screen.getByText('4 sets')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(await screen.findByText('Next stop')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Push' })).toBeVisible()
    expect((await getSettings()).setup_completed_at).not.toBeNull()
    expect((await getStoredRoutine())?.days).toEqual([
      { id: expect.any(String), name: 'Push', exercises: [{ exercise_id: ROW.id, sets: 4 }] },
    ])
  })
})
