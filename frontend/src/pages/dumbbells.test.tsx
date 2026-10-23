import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { seedDevice, set, workout } from '../test/device'
import { libraryExercise } from '../test/library'
import { renderApp } from '../test/utils'

const PRESS = libraryExercise('Dumbbell_Bench_Press', 'Dumbbell Bench Press', {
  equipment: 'dumbbell',
  primary_muscles: ['chest'],
})
/** One finished workout: 2 × 20 kg dumbbells, 10 reps. */
const PRESSED = workout({ id: 'w', performed_on: '2026-09-15' }, [
  [PRESS.id, [set('s', 'we', 1, 20, 10)]],
])

describe('one or two dumbbells', () => {
  it('lets you choose per exercise, and the volume follows', async () => {
    await seedDevice({ library: [PRESS], workouts: [PRESSED] })
    const user = userEvent.setup()
    const router = renderApp(`/exercises/${PRESS.id}`)

    const choice = await screen.findByRole('radiogroup', { name: 'Dumbbells' })
    expect(within(choice).getByRole('radio', { name: /Two, weight of each/ })).toBeChecked()
    await user.click(within(choice).getByRole('radio', { name: /Two, total weight/ }))
    await waitFor(async () =>
      expect(await db.dumbbellModes.get(PRESS.id)).toEqual({
        exercise_id: PRESS.id,
        mode: 'total',
      }),
    )

    // History: logged as the total now, so 20 × 10 counts once.
    await router.navigate('/history?month=2026-09')
    expect(await screen.findByText('1 ride · 1 sets · 200 kg')).toBeVisible()
    await db.dumbbellModes.put({ exercise_id: PRESS.id, mode: 'each' })
    expect(await screen.findByText('1 ride · 1 sets · 400 kg')).toBeVisible()
  })

  it('says "kg each" on the set card', async () => {
    await seedDevice({ library: [PRESS] })
    const user = userEvent.setup()
    renderApp('/workout')
    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Dumbbell Bench Press/ }))

    const card = await screen.findByRole('region', { name: 'Current set' })
    expect(await within(card).findByLabelText('kg each')).toBeVisible()
  })

  it('has no choice for exercises without dumbbells', async () => {
    await seedDevice()
    renderApp('/exercises/Seated_Cable_Rows')
    await screen.findByRole('heading', { name: 'Machine settings' })
    expect(screen.queryByRole('radiogroup', { name: 'Dumbbells' })).toBeNull()
  })
})
