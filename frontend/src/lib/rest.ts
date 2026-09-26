import type { ExerciseSummary } from '../data/types'

export const DEFAULT_REST_SECONDS = 90

const LEG_MUSCLES = new Set(['quadriceps', 'hamstrings', 'glutes'])
const SMALL_MUSCLES = new Set(['calves', 'forearms', 'abdominals', 'neck'])

/**
 * A sensible rest time for an exercise you haven't set one for: heavy compound leg work
 * 3:00, other compound lifts 2:00, isolation work 1:30, small muscles 1:00. Exercises we
 * know too little about get your default.
 */
export function smartRestSeconds(exercise: ExerciseSummary, fallback: number): number {
  const primary = exercise.primary_muscles
  if (primary.length > 0 && primary.every((m) => SMALL_MUSCLES.has(m))) return 60
  if (exercise.mechanic === 'compound') {
    return primary.some((m) => LEG_MUSCLES.has(m)) ? 180 : 120
  }
  if (exercise.mechanic === 'isolation') return 90
  return fallback
}

/** Your rest for an exercise: your own setting if you made one (0 = no timer), else smart. */
export function restSecondsFor(
  exercise: ExerciseSummary,
  preferences: ReadonlyMap<string, number>,
  fallback: number,
): number {
  return preferences.get(exercise.id) ?? smartRestSeconds(exercise, fallback)
}

/** Choices in the rest picker (seconds). */
export const REST_CHOICES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300]
