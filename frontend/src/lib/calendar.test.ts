import { describe, expect, it } from 'vitest'
import { isValidMonth, monthGrid, monthRange, shiftMonth } from './calendar'

describe('calendar', () => {
  it('lays out a month in Monday-first weeks', () => {
    const weeks = monthGrid('2026-09') // 1 Sep 2026 is a Tuesday
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
    expect(weeks.at(-1)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', null, null, null, null])
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
  })

  it('handles months starting on a Monday and leap years', () => {
    expect(monthGrid('2027-02')[0]![0]).toBe('2027-02-01') // Monday
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29)
  })

  it('knows month ranges and moves across years', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('validates month strings from the URL', () => {
    expect(isValidMonth('2026-09')).toBe(true)
    for (const bad of ['2026-13', '2026-9', 'sept', null]) expect(isValidMonth(bad)).toBe(false)
  })
})
