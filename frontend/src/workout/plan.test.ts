import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../data/types'
import { exercise } from '../test/utils'
import { nextSet, type PlannedExercise, plannedSetCount } from './plan'

const s = (
  weight: number | null,
  reps: number | null,
  { done = true, warmup = false, id = `${weight}-${reps}-${Math.random()}` } = {},
): WorkoutSet => ({
  id,
  workout_exercise_id: 'we',
  position: 1,
  weight_kg: weight,
  reps,
  is_warmup: warmup,
  notes: null,
  completed_at: done ? '2026-09-25T18:00:00Z' : null,
})

const ROWS = exercise('1', 'Seated Cable Rows')
const PULLDOWN = exercise('2', 'Wide-Grip Lat Pulldown')

function item(overrides: Partial<PlannedExercise> = {}): PlannedExercise {
  return {
    key: 'rows',
    exercise: ROWS,
    workoutExerciseId: 'we-rows',
    routineSets: undefined,
    sets: [],
    lastTime: [],
    ...overrides,
  }
}

const LAST_ROWS = [s(80, 12), s(80, 10), s(80, 8)]

describe('nextSet', () => {
  it('starts with set 1, prefilled from last time', () => {
    const next = nextSet([item({ lastTime: LAST_ROWS })], new Set())!
    expect(next.setNumber).toBe(1)
    expect(next.plannedSets).toBe(3)
    expect(next.prefill).toEqual({ weight: 80, reps: 12 })
  })

  it('moves to set 2 with last time’s set 2, then to the next exercise', () => {
    const plan = [
      item({ lastTime: LAST_ROWS, sets: [s(82.5, 12)] }),
      item({ key: 'pulldown', exercise: PULLDOWN, lastTime: [s(85, 10)] }),
    ]
    expect(nextSet(plan, new Set())!.prefill).toEqual({ weight: 80, reps: 10 })

    plan[0]!.sets = [s(82.5, 12), s(80, 10), s(80, 8)]
    const next = nextSet(plan, new Set())!
    expect(next.item.exercise.name).toBe('Wide-Grip Lat Pulldown')
    expect(next.prefill).toEqual({ weight: 85, reps: 10 })
    expect(next.plannedSets).toBe(1) // last time's set count
  })

  it('uses the routine’s set count, and today’s previous set once past last time', () => {
    const plan = [item({ routineSets: 4, lastTime: [s(80, 12)], sets: [s(82.5, 11)] })]
    const next = nextSet(plan, new Set())!
    expect(next.setNumber).toBe(2)
    expect(next.plannedSets).toBe(4)
    expect(next.previous).toBeUndefined()
    expect(next.prefill).toEqual({ weight: 82.5, reps: 11 }) // same as set 1 today
  })

  it('fills an open row, keeping what was typed into it', () => {
    const open = s(90, null, { done: false, id: 'open' })
    const next = nextSet([item({ lastTime: LAST_ROWS, sets: [s(80, 12), open] })], new Set())!
    expect(next.openSet?.id).toBe('open')
    expect(next.prefill).toEqual({ weight: 90, reps: 10 })
  })

  it('ignores warm-ups and skipped exercises, and ends when everything is done', () => {
    const plan = [
      item({ routineSets: 1, sets: [s(40, 10, { warmup: true })], lastTime: [s(80, 12)] }),
      item({ key: 'pulldown', exercise: PULLDOWN, routineSets: 1 }),
    ]
    expect(nextSet(plan, new Set())!.item.key).toBe('rows') // the warm-up isn't set 1
    expect(nextSet(plan, new Set(['rows']))!.item.key).toBe('pulldown')
    expect(nextSet(plan, new Set(['rows', 'pulldown']))).toBeNull()
  })

  describe('when the weight went up during the exercise last time', () => {
    const lastTime = [s(10, 12), s(15, 8)]

    it('starts at the weight you ended on, and tells how it went', () => {
      const next = nextSet([item({ lastTime })], new Set())!
      expect(next.prefill).toEqual({ weight: 15, reps: 8 })
      expect(next.movedUp?.first.weight_kg).toBe(10)
      expect(next.movedUp?.final.weight_kg).toBe(15)
    })

    it('then follows what you do today', () => {
      const today = item({ lastTime, sets: [s(12.5, 10)], routineSets: 3 })
      expect(nextSet([today], new Set())!.prefill).toEqual({ weight: 12.5, reps: 10 })
    })

    it('keeps what you typed into an open row', () => {
      const open = item({ lastTime, sets: [s(11, 9, { done: false })] })
      expect(nextSet([open], new Set())!.prefill).toEqual({ weight: 11, reps: 9 })
    })
  })

  it('repeats last time set by set when the weight stayed or came back down', () => {
    for (const lastTime of [
      [s(15, 8), s(12, 10), s(10, 12)], // a drop set
      [s(10, 12), s(15, 8), s(10, 12)], // up and back down
      [s(80, 12), s(80, 10)], // the same weight
    ]) {
      const next = nextSet([item({ lastTime })], new Set())!
      expect(next.prefill).toEqual({ weight: lastTime[0]!.weight_kg, reps: lastTime[0]!.reps })
      expect(next.movedUp).toBeUndefined()
    }
  })

  it('has nothing to prefill the first time ever', () => {
    expect(nextSet([item()], new Set())!.prefill).toEqual({ weight: null, reps: null })
    expect(plannedSetCount(item())).toBe(3)
  })
})
