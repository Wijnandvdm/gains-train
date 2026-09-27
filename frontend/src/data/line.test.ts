import { describe, expect, it } from 'vitest'
import { gainsLine, stationName, weekOf } from './line'

// The imported log's workouts (performed_on), July–September 2026.
const LOG = [
  '2026-07-19',
  '2026-07-22',
  '2026-07-23',
  '2026-07-30',
  '2026-07-30',
  '2026-08-01',
  '2026-08-03',
  '2026-08-04',
  '2026-08-07',
  '2026-08-10',
  '2026-08-15',
  '2026-08-16',
  '2026-08-17',
  '2026-08-20',
  '2026-08-22',
  '2026-08-23', // 4: one bonus ride
  '2026-08-24',
  '2026-08-28',
  '2026-08-30',
  '2026-08-31',
  '2026-09-02', // short
  '2026-09-07',
  '2026-09-07',
  '2026-09-09',
  '2026-09-14',
  '2026-09-15', // this week so far
]
const states = (line: ReturnType<typeof gainsLine>) =>
  [...line.weeks.values()].map((w) => `${w.monday.slice(5)} ${w.state}`)

describe('the Gains Line', () => {
  it('follows the imported log: stations, a ticket spent on the short week, this week open', () => {
    const line = gainsLine(LOG, 3, '2026-09-17')
    expect(states(line)).toEqual([
      '07-13 before', // 1 ride, and 2 the week after: not started yet
      '07-20 before',
      '07-27 reached',
      '08-03 reached',
      '08-10 reached',
      '08-17 reached', // 4 in a row → a ticket, and the bonus ride → another
      '08-24 reached',
      '08-31 ticket', // 2 rides: saved by a ticket
      '09-07 reached',
      '09-14 open', // 2 of 3, and the week isn't over
    ])
    expect(line).toMatchObject({ streak: 6, tickets: 1, nextTicketAt: 8 })
    expect(line.thisWeek.rides).toEqual(['2026-09-14', '2026-09-15'])
    expect(line.lastWeek?.state).toBe('reached')
  })

  it('reaches this week’s station as soon as the target ride is done', () => {
    const line = gainsLine([...LOG, '2026-09-17'], 3, '2026-09-17')
    expect(line.thisWeek.state).toBe('reached')
    expect(line.streak).toBe(7)
  })

  it('starts over after a short week without tickets, and keeps counting missed weeks', () => {
    const line = gainsLine(['2026-09-01', '2026-09-02', '2026-09-08'], 2, '2026-09-24')
    expect(states(line)).toEqual(['08-31 reached', '09-07 missed', '09-14 missed', '09-21 open'])
    expect(line).toMatchObject({ streak: 0, tickets: 0 })
  })

  it('holds at most 2 tickets', () => {
    const busy = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
    expect(gainsLine(busy, 1, '2026-09-06').tickets).toBe(2)
  })

  it('has an open first week before you ever ride', () => {
    const line = gainsLine([], 3, '2026-09-17')
    expect(states(line)).toEqual(['09-14 open'])
    expect(line).toMatchObject({ streak: 0, tickets: 0, lastWeek: null, nextTicketAt: 4 })
  })

  it('skips a parked short week: no ticket spent, the streak waits', () => {
    const line = gainsLine(LOG, 3, '2026-09-17', new Set(['2026-08-31']))
    expect(line.weeks.get('2026-08-31')?.state).toBe('depot')
    expect(line).toMatchObject({ streak: 6, tickets: 2, parkedUntil: null })
  })

  it('still counts a parked week that reaches the target', () => {
    const line = gainsLine(LOG, 3, '2026-09-17', new Set(['2026-09-07']))
    expect(line.weeks.get('2026-09-07')?.state).toBe('reached')
  })

  it('parks this week, and says until when', () => {
    const depot = new Set(['2026-09-14', '2026-09-21', '2026-10-05']) // 28 Sep not parked
    const line = gainsLine(LOG, 3, '2026-09-17', depot)
    expect(line.thisWeek.state).toBe('depot')
    expect(line.parkedUntil).toBe('2026-09-27')
  })

  it('names stations along the line, looping with a lap number', () => {
    expect(stationName(1)).toBe('Warm-Up Halt')
    expect(stationName(7)).toBe('PR Central')
    expect(stationName(21)).toBe('Warm-Up Halt 2')
  })

  it('weeks start on Monday', () => {
    expect(weekOf('2026-09-20')).toBe('2026-09-14') // Sunday
    expect(weekOf('2026-09-14')).toBe('2026-09-14')
    expect(weekOf('2026-11-01')).toBe('2026-10-26') // across the DST change
  })
})
