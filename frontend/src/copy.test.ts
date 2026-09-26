import { describe, expect, it } from 'vitest'
import type { WorkoutSummary } from './data/types'
import { CHEERS, cheer, ridesThisWeek, weekMessage } from './copy'

const workout = (performed_on: string, status: WorkoutSummary['status'] = 'completed') =>
  ({ performed_on, status }) as WorkoutSummary

describe('train copy', () => {
  it('rotates cheers per set, starting with "well on track"', () => {
    expect(cheer(1)).toBe("You're well on track!")
    expect(cheer(2)).toBe('Full steam ahead!')
    expect(cheer(CHEERS.length + 1)).toBe(cheer(1))
  })

  it('counts finished rides in the last 7 days, today included', () => {
    const today = new Date(2026, 8, 25) // Fri 25 Sep
    const rides = [
      workout('2026-09-25'),
      workout('2026-09-19'), // 6 days ago: in
      workout('2026-09-18'), // 7 days ago: out
      workout('2026-09-24', 'in_progress'), // not finished: out
    ]
    expect(ridesThisWeek(rides, today)).toBe(2)
  })

  it('has a message for every week', () => {
    expect(weekMessage(0)).toBe('First ride of the week. All aboard!')
    expect(weekMessage(1)).toBe('1 ride this week. Keep the train rolling!')
    expect(weekMessage(3)).toBe("3 rides this week. You're well on track!")
  })
})
