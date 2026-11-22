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

describe('a past workout', () => {
  it('shows when it started and ended, and how long it took', async () => {
    const timed = workout(
      {
        id: 'timed',
        started_at: new Date(2026, 8, 15, 18, 5).toISOString(),
        ended_at: new Date(2026, 8, 15, 19, 17).toISOString(),
      },
      [[ROW.id, [set('t1', 'twe', 1, 80, 10)]]],
    )
    await seedDevice({ workouts: [timed, PAST] })
    renderApp('/history/timed')
    expect(await screen.findByText('18:05–19:17 · 1 h 12 min')).toBeVisible()
  })

  it('leaves the times out when it has none (imported)', async () => {
    await seedDevice({ workouts: [PAST] }) // no start time
    renderApp('/history/past')
    expect(await screen.findByRole('region', { name: 'Seated Cable Rows' })).toBeVisible()
    expect(screen.queryByText(/ min$| h$/)).toBeNull()
  })

  it('shows the PRs you set in it', async () => {
    const before = workout({ id: 'before', performed_on: '2026-09-08' }, [
      [ROW.id, [set('b1', 'bwe', 1, 80, 10)]],
    ])
    await seedDevice({ workouts: [before, PAST] })
    renderApp('/history/past')

    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    // 80 × 12 beat 80 × 10 the week before: more reps at that weight and a better 1RM.
    expect(
      await within(block).findByRole('img', {
        name: 'Personal record: Best estimated 1RM, Most reps at this weight',
      }),
    ).toHaveTextContent(/^PR$/)
    expect(within(block).getAllByRole('img', { name: /Personal record/ })).toHaveLength(1)
  })
})

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
    expect(await within(shown).findByText('82.5 × 12')).toBeVisible() // once the save shows
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
