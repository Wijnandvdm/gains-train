import type { Muscle } from 'body-highlighter'

/**
 * Our muscle names (from the exercise library) → the body-highlighter's regions.
 * The map has no separate lats region: lats and middle back both light up the upper back.
 */
export const MUSCLE_REGIONS: Record<string, Muscle[]> = {
  abdominals: ['abs', 'obliques'],
  abductors: ['abductors'],
  adductors: ['adductor'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
}

export function regionsFor(muscles: string[]): Muscle[] {
  return [...new Set(muscles.flatMap((m) => MUSCLE_REGIONS[m] ?? []))]
}
