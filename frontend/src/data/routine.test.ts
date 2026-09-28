// Same rules as the former backend's tests/test_routines.py.
import { describe, expect, it } from 'vitest'
import { db, getStoredRoutine } from './db'
import { deleteRoutine, nextDayId, RoutineError, routineFromHistory, saveRoutine } from './routine'
import type { StoredWorkout } from './types'

function workout(
  id: string,
  day: string,
  name: string | null,
  sets = 3,
  routine_day_id: string | null = null,
): StoredWorkout {
  return {
    id,
    name,
    routine_day_id,
    performed_on: day,
    status: 'completed',
    started_at: null,
    ended_at: null,
    notes: null,
    import_key: `k-${id}`,
    exercise_ids: ['Seated_Leg_Curl'],
    exercises: [
      {
        id: `${id}-we`,
        exercise_id: 'Seated_Leg_Curl',
        position: 1,
        notes: null,
        sets: Array.from({ length: sets }, (_, i) => ({
          id: `${id}-${i}`,
          workout_exercise_id: `${id}-we`,
          position: i + 1,
          weight_kg: 50,
          reps: 10,
          is_warmup: false,
          notes: null,
          completed_at: null,
        })),
      },
    ],
  }
}

describe('routine', () => {
  it('builds from history: natural order, latest sets, linked workouts, next day', async () => {
    await db.workouts.bulkAdd([
      workout('1', '2026-09-01', 'Day1 · Legs', 2),
      workout('2', '2026-09-02', 'Day2 · Back', 3),
      workout('3', '2026-09-03', 'Day10 · Extra', 1),
      workout('4', '2026-09-08', 'Day1 · Legs', 3), // newer Day1: 3 sets now
      workout('5', '2026-09-09', 'Day2 · Back', 3),
      workout('6', '2026-09-10', null, 1), // unnamed
    ])
    const routine = (await routineFromHistory())!
    expect(routine.days.map((d) => d.name)).toEqual(['Day1 · Legs', 'Day2 · Back', 'Day10 · Extra'])
    expect(routine.days[0]!.exercises).toEqual([{ exercise_id: 'Seated_Leg_Curl', sets: 3 }])
    const all = await db.workouts.toArray()
    expect(all.find((w) => w.id === '5')!.routine_day_id).toBe(routine.days[1]!.id)
    expect(all.find((w) => w.id === '6')!.routine_day_id).toBeNull()
    // Day2 was done last, so Day10 is next.
    expect(nextDayId(routine, all)).toBe(routine.days[2]!.id)
  })

  it('needs named workouts', async () => {
    expect(await routineFromHistory()).toBeNull()
  })

  it('rotates and wraps; unfinished workouts do not count', async () => {
    const routine = await saveRoutine({
      days: [
        { name: 'A', exercises: [] },
        { name: 'B', exercises: [] },
      ],
    })
    const [a, b] = routine.days.map((d) => d.id)
    expect(nextDayId(routine, [])).toBe(a)
    expect(nextDayId(routine, [workout('1', '2026-09-01', 'A', 1, a!)])).toBe(b)
    expect(
      nextDayId(routine, [
        workout('1', '2026-09-01', 'A', 1, a!),
        workout('2', '2026-09-02', 'B', 1, b!),
      ]),
    ).toBe(a)
    const unfinished = { ...workout('3', '2026-09-03', 'A', 1, a!), status: 'in_progress' as const }
    expect(nextDayId(routine, [workout('1', '2026-09-01', 'A', 1, a!), unfinished])).toBe(b)
  })

  it('keeps day ids on edit and unlinks workouts of removed days', async () => {
    const first = await saveRoutine({
      days: [
        { name: 'A', exercises: [] },
        { name: 'B', exercises: [] },
      ],
    })
    const [a, b] = first.days.map((d) => d.id)
    await db.workouts.bulkAdd([
      workout('1', '2026-09-01', 'A', 1, a!),
      workout('2', '2026-09-02', 'B', 1, b!),
    ])

    const edited = await saveRoutine({
      days: [
        { id: a, name: 'A (legs)', exercises: [{ exercise_id: 'Romanian_Deadlift', sets: 4 }] },
        { name: 'C', exercises: [] },
      ],
    })
    expect(edited.days[0]!.id).toBe(a)
    expect(edited.days[0]!.exercises).toEqual([{ exercise_id: 'Romanian_Deadlift', sets: 4 }])
    expect((await db.workouts.get('1'))!.routine_day_id).toBe(a)
    expect((await db.workouts.get('2'))!.routine_day_id).toBeNull()
  })

  it('validates', async () => {
    await expect(saveRoutine({ days: [] })).rejects.toThrow(RoutineError)
    await expect(saveRoutine({ days: [{ name: ' ', exercises: [] }] })).rejects.toThrow(
      RoutineError,
    )
    await expect(
      saveRoutine({ days: [{ name: 'A', exercises: [{ exercise_id: 'x', sets: 0 }] }] }),
    ).rejects.toThrow(RoutineError)
  })

  it('deleting keeps workouts, unlinked', async () => {
    const routine = await saveRoutine({ days: [{ name: 'A', exercises: [] }] })
    await db.workouts.add(workout('1', '2026-09-01', 'A', 1, routine.days[0]!.id))
    await deleteRoutine()
    expect(await getStoredRoutine()).toBeNull()
    expect((await db.workouts.get('1'))!.routine_day_id).toBeNull()
  })
})
