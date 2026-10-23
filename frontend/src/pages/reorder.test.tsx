import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db, getStoredRoutine } from '../data/db'
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

/**
 * jsdom doesn't lay out pages, so dragging has nowhere to go: give each draggable row a place,
 * one under the other in page order, so the keyboard can move it (Space, arrows, Space).
 */
function layOutRows() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rows = [...document.querySelectorAll('[aria-roledescription="sortable"]')].map(
      (handle) => handle.closest('[style]') ?? handle,
    )
    const i = rows.findIndex((row) => row === this || row.contains(this))
    const top = i < 0 ? 0 : i * 50
    return {
      x: 0,
      y: top,
      top,
      left: 0,
      width: 300,
      height: i < 0 ? 0 : 40,
      bottom: top + 40,
      right: 300,
      toJSON: () => ({}),
    } as DOMRect
  })
}

describe('changing the order before you start', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts with the exercise you dragged to the top, and asks about the routine', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')
    await screen.findByDisplayValue('80')
    layOutRows()

    const today = screen.getByLabelText("Today's exercises")
    within(today)
      .getByRole('button', { name: `Move ${PULLDOWN.name}` })
      .focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowUp}')
    await user.keyboard(' ')

    const card = () => screen.getByRole('region', { name: 'Current set' })
    await waitFor(() => expect(within(card()).getByText(PULLDOWN.name)).toBeVisible())
    expect(screen.getByText('Do the exercises in this order from now on?')).toBeVisible()
    // Only today, until you say yes.
    expect(await dayExercises()).toEqual([ROW.id, PULLDOWN.id])
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(async () => expect(await dayExercises()).toEqual([PULLDOWN.id, ROW.id]))
  })

  it('saves the workout in your order when you start', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')
    await screen.findByDisplayValue('80')
    layOutRows()

    screen.getByRole('button', { name: `Move ${PULLDOWN.name}` }).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowUp}')
    await user.keyboard(' ')
    const card = () => screen.getByRole('region', { name: 'Current set' })
    await waitFor(() => expect(within(card()).getByText(PULLDOWN.name)).toBeVisible())
    await user.type(within(card()).getByLabelText('reps'), '10')
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))

    await screen.findByRole('button', { name: 'Finish' })
    const workout = (await db.workouts.where('status').equals('in_progress').first())!
    expect(workout.exercises.map((we) => we.exercise_id)).toEqual([PULLDOWN.id, ROW.id])
    expect(workout.exercises[0]!.sets).toHaveLength(1) // the first set went to the pulldown
  })
})

describe('adding an exercise before you start', () => {
  it('starts with it, and asks whether to add it to the routine', async () => {
    await seedDevice({
      routine: DAY2_ROUTINE,
      workouts: [LAST_DAY2],
      library: [ROW, PULLDOWN, CURL],
    })
    const user = userEvent.setup()
    renderApp('/workout')
    await screen.findByDisplayValue('80')

    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Barbell Curl/ }))

    const card = () => screen.getByRole('region', { name: 'Current set' })
    await waitFor(() => expect(within(card()).getByText('Barbell Curl')).toBeVisible())
    expect(screen.getByText(`Add Barbell Curl to ${DAY} from now on?`)).toBeVisible()
    await user.type(within(card()).getByLabelText('kg'), '30')
    await user.type(within(card()).getByLabelText('reps'), '10')
    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))

    await screen.findByRole('button', { name: 'Finish' })
    const workout = (await db.workouts.where('status').equals('in_progress').first())!
    expect(workout.exercises.map((we) => we.exercise_id)).toEqual([CURL.id, ROW.id, PULLDOWN.id])
    expect(await dayExercises()).toEqual([ROW.id, PULLDOWN.id]) // the routine only on "Yes"
  })
})

describe('dragging during a workout', () => {
  afterEach(() => vi.restoreAllMocks())

  it('moves the exercise and asks about the routine', async () => {
    const user = await startRoutineDay()
    layOutRows()
    screen.getByRole('button', { name: `Move ${PULLDOWN.name}` }).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowUp}')
    await user.keyboard(' ')

    expect(await screen.findByText('Do the exercises in this order from now on?')).toBeVisible()
    const workout = (await db.workouts.where('status').equals('in_progress').first())!
    expect(workout.exercises.map((we) => we.exercise_id)).toEqual([PULLDOWN.id, ROW.id])
  })
})
