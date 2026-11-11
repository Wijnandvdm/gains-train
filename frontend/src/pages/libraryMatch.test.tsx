import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { PULLDOWN, ROW, seedDevice, set, workout } from '../test/device'
import { libraryExercise } from '../test/library'
import { renderApp } from '../test/utils'

const MINE = libraryExercise('custom-ht', 'Hip thrust machine', { is_custom: true, image_urls: [] })
const NEW = libraryExercise('Machine_Hip_Thrust', 'Machine Hip Thrust')

/** After an update added Machine Hip Thrust, with your own Hip thrust machine logged twice. */
async function seed() {
  await seedDevice({
    library: [ROW, PULLDOWN, NEW],
    customExercises: [MINE],
    workouts: ['a', 'b'].map((id) =>
      workout({ id }, [[MINE.id, [set(`${id}-s`, `${id}-we`, 1, 60, 10)]]]),
    ),
  })
  await db.kv.put({
    key: 'librarySuggestions',
    value: [{ custom_id: MINE.id, library_id: NEW.id }],
  })
}

describe('a new library exercise that looks like one of yours', () => {
  it('asks on the Workout screen, and "yes" moves your history over', async () => {
    await seed()
    const user = userEvent.setup()
    renderApp('/workout')

    const card = await screen.findByRole('region', { name: 'New in the library' })
    expect(card).toHaveTextContent('Machine Hip Thrust: is that your “Hip thrust machine”?')
    expect(card).toHaveTextContent('Your 2 workouts and records with it move over')
    await user.click(within(card).getByRole('button', { name: 'Yes, use it' }))

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'New in the library' })).toBeNull(),
    )
    expect((await db.workouts.get('a'))!.exercise_ids).toEqual([NEW.id])
    expect(await db.customExercises.count()).toBe(0)
  })

  it('"no" keeps yours, and the card goes', async () => {
    await seed()
    const user = userEvent.setup()
    renderApp('/workout')

    const card = await screen.findByRole('region', { name: 'New in the library' })
    await user.click(within(card).getByRole('button', { name: 'No, keep mine' }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'New in the library' })).toBeNull(),
    )
    expect((await db.workouts.get('a'))!.exercise_ids).toEqual([MINE.id])
  })
})
