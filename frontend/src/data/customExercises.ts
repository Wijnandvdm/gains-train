/**
 * Your own exercises, for what the library doesn't have: a name and, optionally, the main
 * muscle (from the library's muscles, so filters and progress know it) and how-to steps,
 * which you can add any time later. Their ids are
 * "custom-<uuid>", so they never clash with the library's.
 *
 * A name the library already has is refused: on the next start the app would merge the two
 * (data/migrate.ts), and your exercise would seem to disappear. Deleting is only for one you
 * haven't used yet, so no workout or routine ever loses its exercise.
 */
import { uuid } from '../lib/uuid'
import { db, getStoredRoutine } from './db'
import { loadLibrary } from './library'
import type { ExerciseDetail } from './types'

class CustomExerciseError extends Error {}

export type CustomExerciseInput = {
  name: string
  muscle: string | null
  /** How to do it, step by step; left as it is when not given. */
  instructions?: string[]
}

/** Steps as typed: one per line, without empty ones. */
const tidySteps = (steps: string[]) => steps.map((s) => s.trim()).filter(Boolean)

const MAX_NAME = 80

/** The name, tidied; throws when it's empty, too long, or another exercise has it. */
async function checkedName(name: string, ownId?: string): Promise<string> {
  const tidy = name.trim().replace(/\s+/g, ' ')
  if (!tidy) throw new CustomExerciseError('Give the exercise a name.')
  if (tidy.length > MAX_NAME) {
    throw new CustomExerciseError(`Keep the name under ${MAX_NAME} characters.`)
  }
  const same = (e: ExerciseDetail) => e.id !== ownId && e.name.toLowerCase() === tidy.toLowerCase()
  if ([...(await loadLibrary()).values()].some(same)) {
    throw new CustomExerciseError(`“${tidy}” is in the library already: pick that one.`)
  }
  if ((await db.customExercises.toArray()).some(same)) {
    throw new CustomExerciseError(`You have an exercise called “${tidy}” already.`)
  }
  return tidy
}

export async function createCustomExercise(input: CustomExerciseInput): Promise<ExerciseDetail> {
  const exercise: ExerciseDetail = {
    id: `custom-${uuid()}`,
    name: await checkedName(input.name),
    equipment: null,
    category: null,
    level: null,
    mechanic: null,
    force: null,
    is_custom: true,
    primary_muscles: input.muscle ? [input.muscle] : [],
    secondary_muscles: [],
    image_urls: [],
    instructions: tidySteps(input.instructions ?? []),
  }
  await db.customExercises.add(exercise)
  return exercise
}

/** Rename it, or change its muscle or steps; past workouts show the new name straight away. */
export async function updateCustomExercise(id: string, input: CustomExerciseInput): Promise<void> {
  const name = await checkedName(input.name, id)
  const changed = await db.customExercises.update(id, {
    name,
    primary_muscles: input.muscle ? [input.muscle] : [],
    ...(input.instructions && { instructions: tidySteps(input.instructions) }),
  })
  if (!changed && !(await db.customExercises.get(id))) {
    throw new CustomExerciseError('This exercise doesn’t exist (anymore).')
  }
}

/** Where the exercise is used, if anywhere: why it can't be deleted. */
export async function customExerciseUse(id: string): Promise<'workouts' | 'routine' | null> {
  if ((await db.workouts.where('exercise_ids').equals(id).count()) > 0) return 'workouts'
  const routine = await getStoredRoutine()
  if (routine?.days.some((d) => d.exercises.some((e) => e.exercise_id === id))) return 'routine'
  return null
}

export async function deleteCustomExercise(id: string): Promise<void> {
  const use = await customExerciseUse(id)
  if (use) {
    throw new CustomExerciseError(
      use === 'workouts'
        ? 'You’ve logged this exercise, so it stays: your history needs it.'
        : 'It’s in your routine: take it out there first.',
    )
  }
  await db.transaction('rw', db.customExercises, db.restPrefs, async () => {
    await db.customExercises.delete(id)
    await db.restPrefs.delete(id) // its rest time, if you set one
  })
}
