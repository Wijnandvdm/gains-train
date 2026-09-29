import type { WorkoutSet } from '../data/types'

/** Numbers work sets 1, 2, 3… and labels warm-ups "W" (warm-ups don't take a number). */
export function setLabels(sets: WorkoutSet[]): string[] {
  let n = 0
  return sets.map((s) => (s.is_warmup ? 'W' : String(++n)))
}

/** Pairs each set with last time's set of the same kind and number (2nd work set ↔ 2nd). */
export function matchPrevious(
  sets: WorkoutSet[],
  previous: WorkoutSet[],
): (WorkoutSet | undefined)[] {
  const prevWarmups = previous.filter((s) => s.is_warmup)
  const prevWork = previous.filter((s) => !s.is_warmup)
  let warmups = 0
  let work = 0
  return sets.map((s) => (s.is_warmup ? prevWarmups[warmups++] : prevWork[work++]))
}
