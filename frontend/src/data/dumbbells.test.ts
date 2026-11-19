import { describe, expect, it } from 'vitest'
import { set, workout } from '../test/device'
import { countOf, dumbbellMode, weightUnit } from './dumbbells'
import { performedSets } from './stats'
import { summarize } from './workouts'

const press = { id: 'Dumbbell_Bench_Press', equipment: 'dumbbell' }
const goblet = { id: 'Goblet_Squat', equipment: 'dumbbell' }
const rows = { id: 'Seated_Cable_Rows', equipment: 'cable' }

describe('dumbbells', () => {
  it('knows one from two dumbbells, and your choice wins', () => {
    expect(dumbbellMode(press)).toBe('each')
    expect(dumbbellMode(goblet)).toBe('one')
    expect(dumbbellMode(press, 'total')).toBe('total')
    expect(dumbbellMode(rows)).toBeNull() // no dumbbells, no choice
    expect(dumbbellMode(rows, 'each')).toBeNull()
  })

  it('counts both dumbbells in volume only when you log the weight of each', () => {
    expect(['one', 'each', 'total', null].map((m) => countOf(m as never))).toEqual([1, 2, 1, 1])
    expect(['one', 'each', 'total', null].map((m) => weightUnit(m as never))).toEqual([
      'kg',
      'kg each',
      'kg total',
      'kg',
    ])
  })

  it('doubles the volume of "each" exercises, nothing else', () => {
    const w = workout({ id: 'w' }, [
      [press.id, [set('p', 'we1', 1, 20, 10)]], // 2 × 20 kg dumbbells
      [rows.id, [set('r', 'we2', 1, 50, 10)]],
    ])
    const count = (id: string) => (id === press.id ? 2 : 1)
    const lookup = (id: string) => ({ id, name: id }) as never
    expect(summarize(w, lookup, count).volume_kg).toBe(20 * 10 * 2 + 50 * 10)
    expect(summarize(w, lookup).volume_kg).toBe(20 * 10 + 50 * 10) // without counts: as logged
    expect(performedSets([w], press.id, count)[0]!.count).toBe(2)
  })
})
