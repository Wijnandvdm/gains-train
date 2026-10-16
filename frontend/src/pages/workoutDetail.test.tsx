import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { ROW, seedDevice, set, workout } from '../test/device'
import { renderApp } from '../test/utils'

const PAST = workout({ id: 'past', name: 'Day2 · Back', ended_at: '2026-09-15T19:00:00Z' }, [
  [
    ROW.id,
    [
      set('s1', 'we', 1, 80, 12),
      set('s2', 'we', 2, 80, 10),
      set('s3', 'we', 3, 80, 8, { completed_at: null }), // planned, never ticked off
    ],
  ],
])

/** The workout's sets in the database, as "kg×reps" (✓ when they count as done). */
async function storedSets(): Promise<string[]> {
  const w = await db.workouts.get('past')
  return w!.exercises[0]!.sets.map((s) => `${s.weight_kg}×${s.reps}${s.completed_at ? ' ✓' : ''}`)
}

async function startEditing() {
  await seedDevice({ workouts: [PAST] })
  const user = userEvent.setup()
  renderApp('/history/past')
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  return { user, block: screen.getByRole('region', { name: 'Seated Cable Rows' }) }
}

describe('editing a past workout', () => {
  it('corrects the numbers, removes a set and adds a forgotten one', async () => {
    const { user, block } = await startEditing()

    const weight = within(block).getByLabelText('Set 1 weight (kg)')
    await user.clear(weight)
    await user.type(weight, '82,5')
    const reps = within(block).getByLabelText('Set 2 reps')
    await user.clear(reps)
    await user.type(reps, '11')
    await user.click(within(block).getByRole('button', { name: 'Remove set 3' }))
    await user.click(within(block).getByRole('button', { name: '+ Add set' })) // copies set 2
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeVisible()
    const shown = screen.getByRole('region', { name: 'Seated Cable Rows' })
    expect(within(shown).getByText('82.5 × 12')).toBeVisible()
    expect(await storedSets()).toEqual(['82.5×12 ✓', '80×11 ✓', '80×11 ✓'])
  })

  it('counts every set you keep as done', async () => {
    const { user } = await startEditing()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(async () => expect(await storedSets()).toEqual(['80×12 ✓', '80×10 ✓', '80×8 ✓']))
  })

  it('throws the changes away on Cancel', async () => {
    const { user, block } = await startEditing()
    await user.click(within(block).getByRole('button', { name: 'Remove set 1' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Seated Cable Rows' })).getByText('80 × 12'),
    ).toBeVisible()
    expect(await storedSets()).toEqual(['80×12 ✓', '80×10 ✓', '80×8'])
  })

  it('only saves sets with a weight and at least 1 rep', async () => {
    const { user, block } = await startEditing()
    await user.clear(within(block).getByLabelText('Set 2 reps'))

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getByText(/Every set needs a weight/)).toBeVisible()
    await user.type(within(block).getByLabelText('Set 2 reps'), '0')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await user.type(within(block).getByLabelText('Set 2 reps'), '9') // "09"
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})
