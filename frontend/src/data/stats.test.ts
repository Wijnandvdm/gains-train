// Same cases and numbers as the former backend's tests/test_stats.py.
import { describe, expect, it } from 'vitest'
import { e1rm } from '../workout/prs'
import { overview, type PerformedSet, records, sessions } from './stats'

const [W1, W2, W3] = ['w1', 'w2', 'w3']
const [D1, D2, D3] = ['2026-09-01', '2026-09-08', '2026-09-15']
const s = (
  workout_id: string,
  performed_on: string,
  weight_kg: number,
  reps: number,
  exercise_id = 'a',
): PerformedSet => ({
  exercise_id,
  workout_id,
  performed_on,
  weight_kg,
  reps,
})

describe('stats', () => {
  it('summarises each workout', () => {
    const result = sessions([
      s(W1, D1, 80, 12),
      s(W1, D1, 85, 8),
      s(W1, D1, 85, 10),
      s(W2, D2, 90, 5),
    ])
    expect(
      result.map((r) => [r.performed_on, r.top_weight_kg, r.top_weight_reps, r.set_count]),
    ).toEqual([
      [D1, 85, 10, 3],
      [D2, 90, 5, 1],
    ])
    expect(result[0]!.volume_kg).toBe(80 * 12 + 85 * 8 + 85 * 10)
    expect(result[0]!.best_e1rm_kg).toBeCloseTo(e1rm(85, 10)!, 2)
  })

  it('finds records (ties dated at the first time)', () => {
    const r = records([
      s(W1, D1, 80, 12),
      s(W1, D1, 85, 10),
      s(W2, D2, 90, 6),
      s(W2, D2, 85, 12), // rep record at 85, beats 80 × 12
      s(W3, D3, 90, 6), // ties the heaviest: stays dated D2
      s(W3, D3, 70, 15),
    ])!
    expect(r.heaviest).toEqual({ weight_kg: 90, reps: 6, performed_on: D2 })
    expect([r.best_e1rm.weight_kg, r.best_e1rm.reps]).toEqual([85, 12])
    expect(r.best_e1rm_kg).toBeCloseTo(e1rm(85, 12)!, 2)
    expect(r.best_session_volume_on).toBe(D1) // 80×12 + 85×10 = 1810 beats 1560 and 1590
    expect(r.rep_records.map((x) => [x.weight_kg, x.reps])).toEqual([
      [90, 6],
      [85, 12],
      [70, 15],
    ])
  })

  it('has no records without reps', () => {
    expect(records([])).toBeNull()
    expect(records([s(W1, D1, 60, 0)])).toBeNull()
  })

  it('builds the dashboard overview', () => {
    const workout = (
      id: string,
      day: string,
      exercise_id: string,
      weight: number,
      reps: number,
    ) => ({
      id,
      name: null,
      routine_day_id: null,
      performed_on: day,
      status: 'completed' as const,
      started_at: null,
      ended_at: null,
      notes: null,
      import_key: 'imported',
      exercise_ids: [exercise_id],
      exercises: [
        {
          id: `${id}-we`,
          exercise_id,
          position: 1,
          notes: null,
          sets: [
            {
              id: `${id}-s`,
              workout_exercise_id: `${id}-we`,
              position: 1,
              weight_kg: weight,
              reps,
              rpe: null,
              is_warmup: false,
              notes: null,
              completed_at: null,
            },
          ],
        },
      ],
    })
    const rows = overview(
      [
        workout('1', D1, 'lat', 85, 10),
        workout('2', D2, 'lat', 90, 12),
        workout('3', D3, 'lat', 85, 10),
        workout('4', D1, 'curl', 30, 10),
      ],
      (id) => ({ id, name: id }) as never,
    )
    expect(rows.map((r) => r.exercise.id)).toEqual(['lat', 'curl'])
    expect([
      rows[0]!.sets_logged,
      rows[0]!.last_performed_on,
      rows[0]!.last_top_weight_kg,
      rows[0]!.max_weight_kg,
    ]).toEqual([3, D3, 85, 90])
    expect(rows[0]!.total_volume_kg).toBe(85 * 10 + 90 * 12 + 85 * 10)
  })
})
