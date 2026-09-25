/**
 * Personal-record detection for sets logged in the workout in progress. It runs on the
 * phone (so it works offline, the moment a set is ticked) against your records from
 * finished workouts plus the earlier sets of this workout. The definitions mirror the
 * backend's app/services/stats.py.
 */
import type { RecordsOut, SetOut } from '../api/schema'

export type PrKind = 'weight' | 'e1rm' | 'reps'

export const PR_LABELS: Record<PrKind, string> = {
  weight: 'Heaviest weight',
  e1rm: 'Best estimated 1RM',
  reps: 'Most reps at this weight',
}

/** Estimated one-rep max (Epley); a single rep is just the weight. */
export function e1rm(weightKg: number, reps: number): number | null {
  if (reps < 1) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

// Record values arrive rounded to 0.01 kg; don't call a rounding difference a PR.
const EPSILON = 0.01

type Lift = { weight: number; reps: number }

/** Sets that count: ticked off, not a warm-up, with weight and reps. */
export function performed(sets: SetOut[]): Lift[] {
  return sets.flatMap((s) =>
    s.completed_at && !s.is_warmup && s.weight_kg !== null && s.reps !== null && s.reps >= 1
      ? [{ weight: s.weight_kg, reps: s.reps }]
      : [],
  )
}

/**
 * Which records `lift` beats. `earlier` are this workout's sets done before it. Nothing
 * counts as a PR the very first time you do an exercise.
 */
export function detectPRs(lift: Lift, records: RecordsOut | null, earlier: Lift[]): PrKind[] {
  if (lift.reps < 1) return []
  const history: Lift[] = [
    ...earlier,
    ...(records
      ? [
          { weight: records.heaviest.weight_kg, reps: records.heaviest.reps },
          { weight: records.best_e1rm.weight_kg, reps: records.best_e1rm.reps },
          ...records.rep_records.map((r) => ({ weight: r.weight_kg, reps: r.reps })),
        ]
      : []),
  ]
  if (history.length === 0) return []

  const kinds: PrKind[] = []
  const heaviest = Math.max(...history.map((h) => h.weight))
  if (lift.weight > heaviest + EPSILON) kinds.push('weight')

  const bestE1rm = Math.max(
    records?.best_e1rm_kg ?? 0,
    ...history.map((h) => e1rm(h.weight, h.reps) ?? 0),
  )
  if ((e1rm(lift.weight, lift.reps) ?? 0) > bestE1rm + EPSILON) kinds.push('e1rm')

  // More reps than ever at this weight or heavier (a weight PR already says it all).
  if (!kinds.includes('weight')) {
    const repsAtOrAbove = history.filter((h) => h.weight >= lift.weight - EPSILON)
    const most = Math.max(...repsAtOrAbove.map((h) => h.reps))
    if (repsAtOrAbove.length > 0 && lift.reps > most) kinds.push('reps')
  }
  return kinds
}

/** PR kinds for each set of an exercise in the workout (in order; empty for non-PRs). */
export function prsForSets(sets: SetOut[], records: RecordsOut | null): PrKind[][] {
  const earlier: Lift[] = []
  return sets.map((s) => {
    const [lift] = performed([s])
    if (!lift) return []
    const kinds = detectPRs(lift, records, earlier)
    earlier.push(lift)
    return kinds
  })
}
