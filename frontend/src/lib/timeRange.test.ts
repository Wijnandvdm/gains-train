import { describe, expect, it } from 'vitest'
import { ALL, defaultRange, inRange, monthsBefore, rangeChoices } from './timeRange'

const labels = (first: string) => rangeChoices(first, '2026-10-26').map((r) => r.label)

describe('time filters that grow with your data', () => {
  it('offers only ranges shorter than your history, plus All', () => {
    expect(labels('2026-09-01')).toEqual([]) // under 3 months: nothing to filter
    expect(labels('2026-06-01')).toEqual(['3 months', 'All'])
    expect(labels('2025-02-10')).toEqual(['3 months', '1 year', 'All'])
    expect(labels('2016-01-01')).toEqual([
      '3 months',
      '1 year',
      '2 years',
      '5 years',
      '10 years',
      'All',
    ])
  })

  it('opens on a year once you have more than a year, else on everything', () => {
    expect(defaultRange(rangeChoices('2025-02-10', '2026-10-26')).label).toBe('1 year')
    expect(defaultRange(rangeChoices('2026-06-01', '2026-10-26'))).toBe(ALL)
  })

  it('counts back from today', () => {
    expect(monthsBefore('2026-10-26', 12)).toBe('2025-10-26')
    expect(inRange('2025-10-26', { months: 12, label: '1 year' }, '2026-10-26')).toBe(true)
    expect(inRange('2025-10-25', { months: 12, label: '1 year' }, '2026-10-26')).toBe(false)
    expect(inRange('1999-01-01', ALL, '2026-10-26')).toBe(true)
  })
})
