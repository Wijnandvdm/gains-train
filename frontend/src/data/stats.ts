/**
 * Progress statistics and personal records, computed on the device from your workouts.
 * (A port of the former backend's app/services/stats.py; same rules, same tests.)
 *
 * - Estimated 1RM (Epley): weight × (1 + reps / 30); a single rep is just the weight.
 * - Heaviest weight: the most weight moved for at least one rep.
 * - Rep record at a weight: the most reps done at that weight, kept only if no heavier
 *   weight was done for as many reps ("85 kg × 12" makes "80 kg × 10" meaningless).
 * - Ties go to the earliest date: a record is dated when it was first achieved.
 * Only finished workouts count, and only performed sets (see isPerformed).
 */
import { e1rm } from '../workout/prs'
import type {
  ExerciseId,
  ExerciseOverview,
  ExerciseStats,
  ExerciseSummary,
  Records,
  SessionPoint,
  SetRecord,
  StoredWorkout,
} from './types'
import { isPerformed } from './workouts'

export type PerformedSet = {
  exercise_id: ExerciseId
  workout_id: string
  performed_on: string
  weight_kg: number
  reps: number
}

/** 0.01 kg precision, like the numbers the old API sent. */
const kg = (value: number) => Math.round(value * 100) / 100

/** Performed sets of finished workouts, oldest first (the order records are dated by). */
export function performedSets(workouts: StoredWorkout[], exerciseId?: ExerciseId): PerformedSet[] {
  const ordered = workouts
    .filter((w) => w.status === 'completed')
    .sort(
      (a, b) =>
        a.performed_on.localeCompare(b.performed_on) ||
        (a.started_at ?? '').localeCompare(b.started_at ?? ''),
    )
  return ordered.flatMap((w) =>
    w.exercises
      .filter((we) => exerciseId === undefined || we.exercise_id === exerciseId)
      .flatMap((we) =>
        we.sets
          .filter((s) => isPerformed(s, w))
          .map((s) => ({
            exercise_id: we.exercise_id,
            workout_id: w.id,
            performed_on: w.performed_on,
            weight_kg: s.weight_kg!,
            reps: s.reps!,
          })),
      ),
  )
}

const volume = (sets: PerformedSet[]) => sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)

function groupBy<K>(sets: PerformedSet[], key: (s: PerformedSet) => K): Map<K, PerformedSet[]> {
  const groups = new Map<K, PerformedSet[]>()
  for (const s of sets) groups.set(key(s), [...(groups.get(key(s)) ?? []), s])
  return groups
}

/** The item with the highest score; among ties, the first (the earliest, given date order). */
function firstBest<T>(items: T[], score: (item: T) => number[]): T {
  const higher = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!
    return false
  }
  return items.reduce((best, item) => (higher(score(item), score(best)) ? item : best))
}

/** Per-workout summaries for one exercise, oldest first (points on the progress chart). */
export function sessions(sets: PerformedSet[]): SessionPoint[] {
  const points: SessionPoint[] = []
  for (const [workout_id, group] of groupBy(sets, (s) => s.workout_id)) {
    const withReps = group.filter((s) => s.reps >= 1)
    if (withReps.length === 0) continue
    const top = firstBest(withReps, (s) => [s.weight_kg, s.reps])
    points.push({
      workout_id,
      performed_on: group[0]!.performed_on,
      top_weight_kg: kg(top.weight_kg),
      top_weight_reps: top.reps,
      best_e1rm_kg: kg(Math.max(...withReps.map((s) => e1rm(s.weight_kg, s.reps) ?? 0))),
      volume_kg: kg(volume(group)),
      set_count: group.length,
    })
  }
  // Stable sort: same-day sessions keep their order.
  return points.sort((a, b) => a.performed_on.localeCompare(b.performed_on))
}

const record = (s: PerformedSet): SetRecord => ({
  weight_kg: kg(s.weight_kg),
  reps: s.reps,
  performed_on: s.performed_on,
})

export function records(sets: PerformedSet[]): Records | null {
  const withReps = sets.filter((s) => s.reps >= 1)
  if (withReps.length === 0) return null

  const heaviest = firstBest(withReps, (s) => [s.weight_kg, s.reps])
  const strongest = firstBest(withReps, (s) => [e1rm(s.weight_kg, s.reps) ?? 0])
  const bestSession = firstBest(sessions(withReps), (s) => [s.volume_kg])

  // Most reps at each weight (first time achieved)…
  const bestAtWeight = new Map<number, PerformedSet>()
  for (const s of withReps) {
    const current = bestAtWeight.get(s.weight_kg)
    if (!current || s.reps > current.reps) bestAtWeight.set(s.weight_kg, s)
  }
  // …keeping only those not matched by a heavier weight.
  const repRecords: SetRecord[] = []
  let mostRepsHeavier = 0
  for (const weight of [...bestAtWeight.keys()].sort((a, b) => b - a)) {
    const s = bestAtWeight.get(weight)!
    if (s.reps > mostRepsHeavier) {
      repRecords.push(record(s))
      mostRepsHeavier = s.reps
    }
  }

  return {
    heaviest: record(heaviest),
    best_e1rm: record(strongest),
    best_e1rm_kg: kg(e1rm(strongest.weight_kg, strongest.reps) ?? 0),
    best_session_volume_kg: bestSession.volume_kg,
    best_session_volume_on: bestSession.performed_on,
    rep_records: repRecords,
  }
}

export function exerciseStats(workouts: StoredWorkout[], exerciseId: ExerciseId): ExerciseStats {
  const sets = performedSets(workouts, exerciseId)
  return { records: records(sets), sessions: sessions(sets) }
}

/** The dashboard: every exercise you've done, most recently trained first. */
export function overview(
  workouts: StoredWorkout[],
  lookup: (id: ExerciseId) => ExerciseSummary,
): ExerciseOverview[] {
  const rows: ExerciseOverview[] = []
  for (const [exerciseId, group] of groupBy(performedSets(workouts), (s) => s.exercise_id)) {
    const points = sessions(group)
    if (points.length === 0) continue
    const last = points.at(-1)!
    rows.push({
      exercise: lookup(exerciseId),
      sets_logged: group.length,
      last_performed_on: last.performed_on,
      last_top_weight_kg: last.top_weight_kg,
      max_weight_kg: Math.max(...points.map((p) => p.top_weight_kg)),
      best_e1rm_kg: Math.max(...points.map((p) => p.best_e1rm_kg)),
      total_volume_kg: kg(volume(group)),
    })
  }
  return rows.sort((a, b) => b.last_performed_on.localeCompare(a.last_performed_on))
}
