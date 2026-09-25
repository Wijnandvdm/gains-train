import type { WorkoutSummary } from '../api/schema'

/** The most recent workout for each distinct name, e.g. your Day1 / Day2 / Day3 split. */
export function recentRoutines(workouts: WorkoutSummary[], max = 4): WorkoutSummary[] {
  const seen = new Set<string>()
  return workouts
    .filter((w) => {
      if (!w.name || w.status !== 'completed' || seen.has(w.name)) return false
      seen.add(w.name)
      return true
    })
    .slice(0, max)
}
