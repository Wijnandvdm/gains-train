import { describe, expect, it } from 'vitest'
import type { RecordsOut, SetOut } from '../data/types'
import { detectPRs, e1rm, prsForSets } from './prs'

// Records like your Lat Pulldown: 90 × 12 heaviest, then 85 × 12 and 80 × 14.
const RECORDS: RecordsOut = {
  heaviest: { weight_kg: 90, reps: 12, performed_on: '2026-09-07' },
  best_e1rm: { weight_kg: 90, reps: 12, performed_on: '2026-09-07' },
  best_e1rm_kg: 126,
  best_session_volume_kg: 2890,
  best_session_volume_on: '2026-09-07',
  rep_records: [
    { weight_kg: 90, reps: 12, performed_on: '2026-09-07' },
    { weight_kg: 80, reps: 14, performed_on: '2026-07-22' },
  ],
}

describe('detectPRs', () => {
  it('is quiet for sets that beat nothing', () => {
    expect(detectPRs({ weight: 85, reps: 10 }, RECORDS, [])).toEqual([])
    expect(detectPRs({ weight: 90, reps: 12 }, RECORDS, [])).toEqual([]) // equal isn't a PR
  })

  it('spots a heavier weight (without also calling it a rep PR)', () => {
    expect(detectPRs({ weight: 92.5, reps: 6 }, RECORDS, [])).toEqual(['weight'])
    expect(detectPRs({ weight: 92.5, reps: 12 }, RECORDS, [])).toEqual(['weight', 'e1rm'])
  })

  it('spots more reps than ever at a weight, counting heavier weights too', () => {
    expect(detectPRs({ weight: 90, reps: 13 }, RECORDS, [])).toEqual(['e1rm', 'reps'])
    // 85 × 13: more than the best at 85 kg or heavier (12). 80 × 14 doesn't count: it's lighter.
    expect(detectPRs({ weight: 85, reps: 13 }, RECORDS, [])).toEqual(['reps'])
    // 80 × 14 ties the 80 kg record: no PR.
    expect(detectPRs({ weight: 80, reps: 14 }, RECORDS, [])).toEqual([])
  })

  it('compares with earlier sets of the same workout', () => {
    const earlier = [{ weight: 95, reps: 5 }]
    expect(detectPRs({ weight: 95, reps: 5 }, RECORDS, earlier)).toEqual([])
    expect(detectPRs({ weight: 95, reps: 6 }, RECORDS, earlier)).toEqual(['reps'])
  })

  it('never calls the very first time a PR', () => {
    expect(detectPRs({ weight: 100, reps: 10 }, null, [])).toEqual([])
    expect(detectPRs({ weight: 100, reps: 11 }, null, [{ weight: 100, reps: 10 }])).toEqual([
      'e1rm',
      'reps',
    ])
  })

  it('ignores rounding noise in the records', () => {
    const rounded = { ...RECORDS, best_e1rm_kg: 125.99 } // 90 × 12 = 126 exactly
    expect(detectPRs({ weight: 90, reps: 12 }, rounded, [])).toEqual([])
  })
})

describe('prsForSets', () => {
  const set = (id: string, weight: number, reps: number, done = true, warmup = false): SetOut => ({
    id,
    workout_exercise_id: 'we',
    position: 1,
    weight_kg: weight,
    reps,
    rpe: null,
    is_warmup: warmup,
    notes: null,
    completed_at: done ? '2026-09-25T18:00:00Z' : null,
  })

  it('checks each ticked-off work set against records and the sets before it', () => {
    expect(
      prsForSets(
        [
          set('w', 100, 10, true, true), // warm-up: never a PR
          set('a', 92.5, 8), // heaviest ever
          set('b', 92.5, 8), // same again: no PR
          set('c', 95, 3, false), // not ticked off
        ],
        RECORDS,
      ),
    ).toEqual([[], ['weight'], [], []])
  })
})

it('e1rm uses Epley', () => {
  expect(e1rm(100, 1)).toBe(100)
  expect(e1rm(90, 12)).toBeCloseTo(126)
  expect(e1rm(60, 0)).toBeNull()
})
