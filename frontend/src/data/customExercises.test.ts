import { beforeEach, describe, expect, it } from 'vitest'
import { DAY2_ROUTINE, ROW, seedDevice, set, workout } from '../test/device'
import {
  createCustomExercise,
  customExerciseUse,
  deleteCustomExercise,
  updateCustomExercise,
} from './customExercises'
import { db } from './db'

describe('custom exercises', () => {
  beforeEach(() => seedDevice()) // library: Seated Cable Rows, Wide-Grip Lat Pulldown

  it('makes one with a tidy name and, if you like, its main muscle', async () => {
    const made = await createCustomExercise({ name: '  Hip   thrust machine ', muscle: 'glutes' })
    expect(made.id).toMatch(/^custom-/)
    expect(await db.customExercises.get(made.id)).toMatchObject({
      name: 'Hip thrust machine',
      is_custom: true,
      primary_muscles: ['glutes'],
      instructions: [],
    })
    const plain = await createCustomExercise({ name: 'Sled push', muscle: null })
    expect(plain.primary_muscles).toEqual([])
  })

  it('refuses an empty name, and names the library or you have already', async () => {
    await expect(createCustomExercise({ name: '  ', muscle: null })).rejects.toThrow(
      'Give the exercise a name.',
    )
    await expect(createCustomExercise({ name: 'seated cable ROWS', muscle: null })).rejects.toThrow(
      '“seated cable ROWS” is in the library already',
    )
    await createCustomExercise({ name: 'Sled push', muscle: null })
    await expect(createCustomExercise({ name: 'sled push', muscle: null })).rejects.toThrow(
      'You have an exercise called “sled push” already.',
    )
  })

  it('renames it, changes its muscle and adds how-to steps later', async () => {
    const { id } = await createCustomExercise({ name: 'Sled push', muscle: null })
    await updateCustomExercise(id, {
      name: 'Sled Push', // only the capitals: still its own name
      muscle: 'quadriceps',
      instructions: ['  Lean into the handles.', '', 'Drive with your legs. '],
    })
    expect(await db.customExercises.get(id)).toMatchObject({
      name: 'Sled Push',
      primary_muscles: ['quadriceps'],
      instructions: ['Lean into the handles.', 'Drive with your legs.'],
    })

    // Without steps given, they stay as they are.
    await updateCustomExercise(id, { name: 'Sled drive', muscle: null })
    expect((await db.customExercises.get(id))!.instructions).toHaveLength(2)
    await expect(updateCustomExercise(id, { name: ROW.name, muscle: null })).rejects.toThrow(
      'is in the library already',
    )
  })

  it('deletes one you haven’t used yet, with its rest time', async () => {
    const { id } = await createCustomExercise({ name: 'Sled push', muscle: null })
    await db.restPrefs.put({ exercise_id: id, rest_seconds: 60 })
    expect(await customExerciseUse(id)).toBeNull()
    await deleteCustomExercise(id)
    expect(await db.customExercises.get(id)).toBeUndefined()
    expect(await db.restPrefs.get(id)).toBeUndefined()
  })

  it('keeps one you logged or put in your routine', async () => {
    const logged = await createCustomExercise({ name: 'Sled push', muscle: null })
    await db.workouts.put(workout({ id: 'w' }, [[logged.id, [set('s', 'we', 1, 50, 10)]]]))
    await expect(deleteCustomExercise(logged.id)).rejects.toThrow('your history needs it')

    const planned = await createCustomExercise({ name: 'Farmer carry', muscle: null })
    const day = DAY2_ROUTINE.days[0]!
    await db.kv.put({
      key: 'routine',
      value: { days: [{ ...day, exercises: [{ exercise_id: planned.id, sets: 3 }] }] },
    })
    expect(await customExerciseUse(planned.id)).toBe('routine')
    await expect(deleteCustomExercise(planned.id)).rejects.toThrow('take it out there first')
  })
})
