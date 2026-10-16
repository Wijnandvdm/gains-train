import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getStoredRoutine } from '../data/db'
import { DAY2_ROUTINE, LAST_DAY2, PULLDOWN, ROW, seedDevice } from '../test/device'
import { libraryExercise } from '../test/library'
import { renderApp } from '../test/utils'

const CURL = libraryExercise('Barbell_Curl', 'Barbell Curl', { primary_muscles: ['biceps'] })
const DAY = 'Day2 · Back & Triceps'

/** Start today's routine day (Seated Cable Rows, then Wide-Grip Lat Pulldown) with set 1. */
async function startRoutineDay() {
  await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2], library: [ROW, PULLDOWN, CURL] })
  const user = userEvent.setup()
  renderApp('/workout')
  await screen.findByDisplayValue('80') // the card has settled on last time's numbers
  await user.click(
    within(screen.getByRole('region', { name: 'Current set' })).getByRole('button', {
      name: '✓ Done',
    }),
  )
  await screen.findByRole('button', { name: 'Finish' })
  return user
}

async function addCurl(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
  await user.click(await screen.findByRole('button', { name: /Barbell Curl/ }))
}

const dayExercises = async () =>
  (await getStoredRoutine())!.days[0]!.exercises.map((e) => e.exercise_id)

describe('changing a routine workout on the go', () => {
  it('asks to add an extra exercise to the routine day', async () => {
    const user = await startRoutineDay()
    await addCurl(user)

    expect(await screen.findByText(`Add Barbell Curl to ${DAY} from now on?`)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('Routine updated.')).toBeVisible()
    expect(await dayExercises()).toEqual([ROW.id, PULLDOWN.id, CURL.id])
  })

  it('asks to take a removed exercise out of the routine day', async () => {
    const user = await startRoutineDay()
    const pulldown = screen.getByRole('region', { name: PULLDOWN.name })
    await user.click(within(pulldown).getByRole('button', { name: 'Remove' }))

    expect(
      await screen.findByText(`Take ${PULLDOWN.name} out of ${DAY} from now on?`),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(async () => expect(await dayExercises()).toEqual([ROW.id]))
  })

  it('stops asking once you log a set, and "Not now" changes nothing', async () => {
    const user = await startRoutineDay()
    await addCurl(user)
    await screen.findByText(/^Add Barbell Curl/)
    await user.click(
      within(screen.getByRole('region', { name: 'Current set' })).getByRole('button', {
        name: '✓ Done',
      }),
    )
    await waitFor(() => expect(screen.queryByText(/^Add Barbell Curl/)).toBeNull())

    const pulldown = screen.getByRole('region', { name: PULLDOWN.name })
    await user.click(within(pulldown).getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/out of/)).toBeNull()
    expect(await dayExercises()).toEqual([ROW.id, PULLDOWN.id])
  })

  it('doesn’t ask in a workout without a routine', async () => {
    await seedDevice({ library: [ROW, PULLDOWN, CURL] })
    const user = userEvent.setup()
    renderApp('/workout')
    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Barbell Curl/ }))
    await screen.findByRole('region', { name: 'Barbell Curl' })
    expect(screen.queryByText(/from now on\?/)).toBeNull()
  })

  it('has a handle to drag each exercise by', async () => {
    await startRoutineDay()
    expect(screen.getByRole('button', { name: `Move ${ROW.name}` })).toBeVisible()
    expect(screen.getByRole('button', { name: `Move ${PULLDOWN.name}` })).toBeVisible()
  })
})
