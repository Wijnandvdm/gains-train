/**
 * "What's the next set, and what should it say?", for the one-tap focus card.
 *
 * Each exercise has a planned number of work sets (from the routine, else from last time).
 * The next set is the first one not yet done, in exercise order. Its numbers are prefilled
 * from the same set last time ("set 2 today = set 2 last time").
 */
import type { ExerciseSummary, WorkoutSet } from '../data/types'

export const DEFAULT_PLANNED_SETS = 3

export type PlannedExercise = {
  /** Stable key: the workout exercise id, or the exercise id before the workout exists. */
  key: string
  exercise: ExerciseSummary
  /** null until the workout has been started (the "up next" preview). */
  workoutExerciseId: string | null
  /** From the routine; undefined for exercises that aren't in it. */
  routineSets: number | undefined
  /** This workout's sets for the exercise (all of them, in order). */
  sets: WorkoutSet[]
  /** The previous session's sets for the exercise. */
  lastTime: WorkoutSet[]
}

export type NextSet = {
  item: PlannedExercise
  /** 1-based, counting work sets only */
  setNumber: number
  plannedSets: number
  prefill: { weight: number | null; reps: number | null }
  /** Last time's matching set, for the "last time" hint. */
  previous: WorkoutSet | undefined
  /** When the weight went up during the exercise last time: its first and final set. */
  movedUp: { first: WorkoutSet; final: WorkoutSet } | undefined
  /** An existing, not yet ticked row to fill in (instead of adding a new one). */
  openSet: WorkoutSet | undefined
}

const workSets = (sets: WorkoutSet[]) => sets.filter((s) => !s.is_warmup)

export function plannedSetCount(item: PlannedExercise): number {
  const fromPlan = item.routineSets ?? (workSets(item.lastTime).length || DEFAULT_PLANNED_SETS)
  // Rows added by hand ("+ Add set") extend the plan.
  return Math.max(fromPlan, workSets(item.sets).length)
}

export function nextSet(plan: PlannedExercise[], skipped: ReadonlySet<string>): NextSet | null {
  for (const item of plan) {
    if (skipped.has(item.key)) continue
    const work = workSets(item.sets)
    const done = work.filter((s) => s.completed_at)
    const plannedSets = plannedSetCount(item)
    if (done.length >= plannedSets) continue

    const openSet = work.find((s) => !s.completed_at)
    const last = workSets(item.lastTime)
    const previous = last[done.length]
    const fallback = done.at(-1) ?? last.at(-1)
    // You ended heavier than you started, so start there: don't repeat the lighter sets. After
    // that, follow today's sets (you may have gone back down a little).
    const first = last[0]
    const final = last.at(-1)
    const movedUp =
      first && final && (final.weight_kg ?? 0) > (first.weight_kg ?? 0)
        ? { first, final }
        : undefined
    const start = movedUp && (done.at(-1) ?? movedUp.final)
    return {
      item,
      setNumber: done.length + 1,
      plannedSets,
      previous,
      movedUp,
      openSet,
      prefill: {
        // Anything typed into the open row wins; then last time's same set; then the
        // set before it today; then last time's final set.
        weight: openSet?.weight_kg ?? (start ?? previous ?? fallback)?.weight_kg ?? null,
        reps: openSet?.reps ?? (start ?? previous ?? fallback)?.reps ?? null,
      },
    }
  }
  return null
}

/** Weight steps for the −/+ buttons: dumbbells go up in smaller jumps. */
export function weightStep(exercise: ExerciseSummary): number {
  return exercise.equipment === 'dumbbell' || exercise.equipment === 'kettlebells' ? 1 : 2.5
}
