// A small exercise library for tests, shaped like the real one (ids are dataset slugs).
import type { ExerciseDetail } from '../data/types'

export function libraryExercise(
  id: string,
  name: string,
  overrides: Partial<ExerciseDetail> = {},
): ExerciseDetail {
  return {
    id,
    name,
    equipment: 'machine',
    category: 'strength',
    level: 'beginner',
    mechanic: 'isolation',
    force: 'pull',
    is_custom: false,
    primary_muscles: ['hamstrings'],
    secondary_muscles: [],
    image_urls: [`/exercises/${id}/0.jpg`, `/exercises/${id}/1.jpg`],
    instructions: ['Sit down.', 'Curl.'],
    ...overrides,
  }
}

export const LIBRARY: ExerciseDetail[] = [
  libraryExercise('Seated_Leg_Curl', 'Seated Leg Curl'),
  libraryExercise('Lying_Leg_Curls', 'Lying Leg Curls'),
  libraryExercise('Incline_Dumbbell_Curl', 'Incline Dumbbell Curl', {
    equipment: 'dumbbell',
    primary_muscles: ['biceps'],
    secondary_muscles: ['forearms'],
  }),
  libraryExercise('Romanian_Deadlift', 'Romanian Deadlift', {
    equipment: 'barbell',
    mechanic: 'compound',
    primary_muscles: ['hamstrings'],
    secondary_muscles: ['glutes', 'lower back'],
  }),
  libraryExercise('Curl_Bar_50', 'Curl 50% Test', {
    equipment: 'e-z curl bar',
    primary_muscles: ['biceps'],
  }),
]
