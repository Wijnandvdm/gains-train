// Same rules as the former backend's tests/test_routines.py.
import { describe, expect, it } from 'vitest'
import { db, getStoredRoutine } from './db'
import { deleteRoutine, nextDayId, RoutineError, saveRoutine } from './routine'
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
