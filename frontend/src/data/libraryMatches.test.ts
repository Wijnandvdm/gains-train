import { describe, expect, it } from 'vitest'
import { libraryExercise } from '../test/library'
import { matchScore, suggestMatches } from './libraryMatches'

const mine = (name: string, muscle = 'glutes') =>
  libraryExercise(`custom-${name}`, name, { is_custom: true, primary_muscles: [muscle] })
const theirs = (id: string, name: string, muscle = 'glutes') =>
  libraryExercise(id, name, { primary_muscles: [muscle] })

describe('matching your exercises to new library ones', () => {
  it('scores names by the words they share, a bit more for the same main muscle', () => {
    expect(matchScore(mine('Hip thrust machine'), theirs('a', 'Machine Hip Thrust'))).toBe(1)
    expect(matchScore(mine('Leg curls', 'hamstrings'), theirs('b', 'Leg Curl', 'quadriceps'))).toBe(
      1,
    )
    expect(matchScore(mine('Sled push'), theirs('c', 'Barbell Bench Press', 'chest'))).toBe(0)
    expect(matchScore(mine('Sled push'), theirs('d', 'Prowler Sled Push'))).toBeCloseTo(
      2 / 3 + 0.15,
    )
  })

  it('suggests the closest new exercise, only when it is close enough', () => {
    const added = [theirs('a', 'Machine Hip Thrust'), theirs('b', 'Hip Abduction Machine')]
    expect(suggestMatches([mine('Hip thrust machine'), mine('Sled push')], added)).toEqual([
      { custom_id: 'custom-Hip thrust machine', library_id: 'a' },
    ])
  })
})
