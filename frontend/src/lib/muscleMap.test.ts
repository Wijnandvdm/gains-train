import { describe, expect, it } from 'vitest'
import { MUSCLE_REGIONS, regionsFor } from './muscleMap'

// The 17 muscles the exercise library uses (frontend/public/exercises).
const LIBRARY_MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
]

describe('muscle map regions', () => {
  it('covers every muscle in the library', () => {
    expect(Object.keys(MUSCLE_REGIONS).sort()).toEqual([...LIBRARY_MUSCLES].sort())
  })

  it('maps muscles to regions without duplicates', () => {
    expect(regionsFor(['lats', 'middle back', 'shoulders'])).toEqual([
      'upper-back',
      'front-deltoids',
      'back-deltoids',
    ])
    expect(regionsFor(['unknown'])).toEqual([])
  })
})
