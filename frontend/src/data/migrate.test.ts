import { describe, expect, it } from 'vitest'
import { db, getStoredRoutine } from './db'
import { setLibraryForTests } from './library'
import { syncWithLibrary } from './migrate'
import { libraryExercise } from '../test/library'
import { set, workout } from '../test/device'

const SQUAT = libraryExercise('bulgarian-split-squat', 'Bulgarian Split Squat')
const ROWS = libraryExercise('Seated_Cable_Rows', 'Seated Row')
const GONE = libraryExercise('Zottman_Curl', 'Zottman Curl', { instructions: ['Curl, turn.'] })

const logged = (id: string, exerciseId: string) =>
  workout({ id }, [[exerciseId, [set(`${id}-s`, `${id}-we`, 1, 20, 10)]]])

describe('keeping your data in step with the library', () => {
  it('keeps a logged exercise that left the library, as a custom exercise', async () => {
    setLibraryForTests([ROWS], [GONE])
    await db.workouts.bulkPut([logged('a', 'Zottman_Curl'), logged('b', ROWS.id)])

    expect(await syncWithLibrary()).toEqual({ kept: 1, merged: 0 })
    expect(await db.customExercises.get('Zottman_Curl')).toMatchObject({
      name: 'Zottman Curl',
      is_custom: true,
      image_urls: [],
      instructions: ['Curl, turn.'],
    })
    expect(await syncWithLibrary()).toEqual({ kept: 0, merged: 0 }) // nothing left to do
  })

  it('merges a custom exercise into the library one with the same name', async () => {
    setLibraryForTests([SQUAT, ROWS])
    await db.customExercises.put({ ...SQUAT, id: 'custom-1', is_custom: true, image_urls: [] })
    await db.workouts.put(
      workout({ id: 'a' }, [
        ['custom-1', [set('s1', 'we1', 1, 24, 10)]],
        [ROWS.id, [set('s2', 'we2', 1, 80, 10)]],
      ]),
    )
    await db.kv.put({
      key: 'routine',
      value: {
        days: [{ id: 'd1', name: 'Legs', exercises: [{ exercise_id: 'custom-1', sets: 3 }] }],
      },
    })
    await db.restPrefs.put({ exercise_id: 'custom-1', rest_seconds: 120 })

    expect(await syncWithLibrary()).toEqual({ kept: 0, merged: 1 })
    const w = (await db.workouts.get('a'))!
    expect(w.exercises.map((we) => we.exercise_id)).toEqual([SQUAT.id, ROWS.id])
    expect(w.exercise_ids).toEqual([SQUAT.id, ROWS.id])
    expect((await getStoredRoutine())!.days[0]!.exercises[0]!.exercise_id).toBe(SQUAT.id)
    expect(await db.restPrefs.toArray()).toEqual([{ exercise_id: SQUAT.id, rest_seconds: 120 }])
    expect(await db.customExercises.count()).toBe(0)
  })
})
