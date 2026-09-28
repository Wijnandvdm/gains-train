import { describe, expect, it } from 'vitest'
import type { WorkoutSet, StoredWorkout } from './types'
import { db } from './db'
import {
  activeWorkout,
  addExercise,
  deleteSet,
  exerciseSessions,
  finishWorkout,
  getWorkout,
  isPerformed,
  removeExercise,
  saveSet,
  startWorkout,
  summarize,
  updateWorkout,
  WorkoutError,
  workoutsBetween,
} from './workouts'

const start = (performed_on = '2026-09-25') =>
  startWorkout({
    name: 'Legs',
    performed_on,
    started_at: `${performed_on}T18:00:00Z`,
    routine_day_id: null,
  })

function set(
  id: string,
  weId: string,
  position: number,
  overrides: Partial<WorkoutSet> = {},
): WorkoutSet {
  return {
    id,
    workout_exercise_id: weId,
    position,
    weight_kg: 60,
    reps: 8,
    is_warmup: false,
    notes: null,
    completed_at: '2026-09-25T18:05:00Z',
    ...overrides,
  }
}

const lookup = (id: string) =>
  ({ id, name: id.replaceAll('_', ' ') }) as unknown as Parameters<typeof summarize>[1] extends (
    id: string,
  ) => infer R
    ? R
    : never

describe('workouts on the device', () => {
  it('starts a workout, and only one at a time', async () => {
    const id = await start()
    expect((await activeWorkout())?.id).toBe(id)
    await expect(start()).rejects.toThrow(WorkoutError)
    await finishWorkout(id)
    await start() // fine once the first is finished
  })

  it('adds and removes exercises, keeping positions 1..n', async () => {
    const id = await start()
    const a = await addExercise(id, 'Seated_Leg_Curl')
    await addExercise(id, 'Romanian_Deadlift')
    await addExercise(id, 'Lying_Leg_Curls')
    await removeExercise(id, a)
    const w = (await getWorkout(id))!
    expect(w.exercises.map((we) => [we.exercise_id, we.position])).toEqual([
      ['Romanian_Deadlift', 1],
      ['Lying_Leg_Curls', 2],
    ])
    expect(w.exercise_ids).toEqual(['Romanian_Deadlift', 'Lying_Leg_Curls'])
  })

  it('saves sets (replacing by id, ordered by position) and deletes them', async () => {
    const id = await start()
    const we = await addExercise(id, 'Seated_Leg_Curl')
    await saveSet(id, set('s2', we, 2))
    await saveSet(id, set('s1', we, 1))
    await saveSet(id, set('s2', we, 2, { weight_kg: 62.5, reps: 6 }))
    let sets = (await getWorkout(id))!.exercises[0]!.sets
    expect(sets.map((s) => [s.id, s.weight_kg, s.reps])).toEqual([
      ['s1', 60, 8],
      ['s2', 62.5, 6],
    ])
    await deleteSet(id, 's1')
    await deleteSet(id, 's1') // already gone: fine
    sets = (await getWorkout(id))!.exercises[0]!.sets
    expect(sets.map((s) => s.id)).toEqual(['s2'])
    await expect(saveSet(id, set('x', 'no-such-exercise', 1))).rejects.toThrow(WorkoutError)
  })

  it('finishes once, and edits details', async () => {
    const id = await start()
    await finishWorkout(id, '2026-09-25T19:00:00Z')
    await finishWorkout(id, '2026-09-25T20:00:00Z')
    await updateWorkout(id, { notes: 'felt strong', performed_on: '2026-09-24' })
    const w = (await getWorkout(id))!
    expect([w.status, w.ended_at, w.notes, w.performed_on]).toEqual([
      'completed',
      '2026-09-25T19:00:00Z',
      'felt strong',
      '2026-09-24',
    ])
  })

  it('lists history newest first, by date range', async () => {
    for (const day of ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01']) {
      await finishWorkout(await start(day))
    }
    const september = await workoutsBetween('2026-09-01', '2026-09-30')
    expect(september.map((w) => w.performed_on)).toEqual(['2026-09-30', '2026-09-01'])
    expect((await workoutsBetween()).length).toBe(4)
  })

  it('counts only performed sets in totals', () => {
    const w: StoredWorkout = {
      id: 'w',
      name: null,
      routine_day_id: null,
      performed_on: '2026-09-20',
      status: 'completed',
      started_at: null,
      ended_at: null,
      notes: null,
      import_key: null,
      exercise_ids: ['Seated_Leg_Curl'],
      exercises: [
        {
          id: 'we',
          exercise_id: 'Seated_Leg_Curl',
          position: 1,
          notes: null,
          sets: [
            set('warmup', 'we', 1, { weight_kg: 40, reps: 10, is_warmup: true }),
            set('done', 'we', 2, { weight_kg: 110, reps: 8 }),
            set('not-ticked', 'we', 3, { weight_kg: 110, reps: 7, completed_at: null }),
            set('no-reps', 'we', 4, { weight_kg: 110, reps: null }),
          ],
        },
      ],
    }
    const summary = summarize(w, lookup)
    expect([summary.set_count, summary.volume_kg, summary.exercise_names]).toEqual([
      1,
      880,
      ['Seated Leg Curl'],
    ])
    // Imported workouts have no tick timestamps, but their sets were done.
    expect(isPerformed(set('x', 'we', 1, { completed_at: null }), { import_key: 'legacy' })).toBe(
      true,
    )
  })

  it('finds last time for an exercise: finished workouts only, newest first', async () => {
    for (const [day, weight] of [
      ['2026-09-01', 100],
      ['2026-09-08', 105],
    ] as const) {
      const id = await start(day)
      const we = await addExercise(id, 'Seated_Leg_Curl')
      await saveSet(id, set(`s-${day}`, we, 1, { weight_kg: weight }))
      await finishWorkout(id)
    }
    const inProgress = await start('2026-09-15')
    const we = await addExercise(inProgress, 'Seated_Leg_Curl')
    await saveSet(inProgress, set('today', we, 1, { weight_kg: 110 }))

    const [last] = await exerciseSessions('Seated_Leg_Curl')
    expect([last!.performed_on, last!.sets[0]!.weight_kg]).toEqual(['2026-09-08', 105])
    expect((await exerciseSessions('Seated_Leg_Curl', 5)).length).toBe(2)
    expect(await exerciseSessions('Romanian_Deadlift')).toEqual([])
  })

  it('persists in IndexedDB', async () => {
    const id = await start()
    expect(await db.workouts.count()).toBe(1)
    expect((await db.workouts.get(id))?.name).toBe('Legs')
  })
})
