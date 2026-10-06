/**
 * The passport: stamps for milestones, worked out from your finished workouts (so restored
 * history counts, and nothing is stored). Each stamp knows when you earned it and with which
 * workout, so finishing a workout can announce the stamps it earned.
 */
import { detectPRs } from '../workout/prs'
import { gainsLine, nextMonday, weekOf } from './line'
import { type PerformedSet, performedSets } from './stats'
import type { StoredWorkout } from './types'

export type StampKind = 'rides' | 'weight' | 'prs' | 'streak' | 'climbing' | 'explorer'

export type Stamp = {
  id: string
  kind: StampKind
  goal: number
  title: string
  detail: string
  /** What the stamp itself says, when not its number (e.g. "All"). */
  badge?: string
  /** The day you earned it; null while you're still working towards it. */
  earnedOn: string | null
  /** The workout that earned it. */
  earnedBy: string | null
}

export type Passport = {
  stamps: Stamp[]
  /**
   * How far you are, per kind: rides, tonnes hauled, PRs, best streak, most weeks climbing,
   * exercises done.
   */
  progress: Record<StampKind, number>
}

const RIDES = [1, 10, 25, 50, 100, 250, 500]
/** Tonnes, compared to train cars (roughly: fully loaded, where it applies). */
const HAULED: [number, string][] = [
  [40, 'A passenger carriage'],
  [90, 'A loaded freight wagon'],
  [130, 'A locomotive'],
  [350, 'A commuter train'],
  [1000, 'A freight train'],
]
const PRS = [1, 10, 25, 50, 100]
const STREAKS: [number, string][] = [
  [4, 'stations in a row'],
  [8, 'stations in a row'],
  [12, 'stations in a row'],
  [26, 'half a year of stations'],
  [52, 'a whole year of stations'],
]
/** Weeks in a row that one exercise got stronger. */
const CLIMBS = [3, 4, 6, 8]
/** Different library exercises done; the last stamp is for all of them. */
const EXPLORED = [25, 50, 100, 200]

type Milestone = { day: string; workoutId: string }

/** Oldest first; the order milestones happen in. */
function chronological(workouts: StoredWorkout[]): StoredWorkout[] {
  return workouts
    .filter((w) => w.status === 'completed')
    .sort(
      (a, b) =>
        a.performed_on.localeCompare(b.performed_on) ||
        (a.started_at ?? '').localeCompare(b.started_at ?? ''),
    )
}

/** For each goal, the first moment a running count reaches it. */
function reachedAt(
  goals: number[],
  events: { value: number; at: Milestone }[],
): (Milestone | null)[] {
  return goals.map((goal) => events.find((e) => e.value >= goal)?.at ?? null)
}

/**
 * Personal records: per exercise and workout, whether any set beat everything done on that
 * exercise in earlier workouts (heavier, a better estimated 1RM, or more reps at that weight).
 * Stricter than the 🏆 badge during a workout, which also compares with earlier sets of the
 * same workout: here, a first session never counts.
 */
function prWorkouts(workouts: StoredWorkout[]): Milestone[] {
  const history = new Map<string, { weight: number; reps: number }[]>()
  const found: Milestone[] = []
  const sessions = new Map<string, PerformedSet[]>() // workout + exercise → its sets, in order
  for (const set of performedSets(workouts)) {
    const key = `${set.workout_id}|${set.exercise_id}`
    sessions.set(key, [...(sessions.get(key) ?? []), set])
  }
  for (const sets of sessions.values()) {
    const { exercise_id, workout_id, performed_on } = sets[0]!
    const before = history.get(exercise_id) ?? []
    const lifts = sets.map((s) => ({ weight: s.weight_kg, reps: s.reps }))
    if (before.length > 0 && lifts.some((lift) => detectPRs(lift, null, before).length > 0)) {
      found.push({ day: performed_on, workoutId: workout_id })
    }
    history.set(exercise_id, [...before, ...lifts])
  }
  return found
}

/**
 * Climbing: one exercise getting stronger week after week. A week climbs when one of its sets
 * beats everything done on that exercise the week before (heavier, a better estimated 1RM,
 * or more reps at that weight); a week without the exercise starts the count over. The value
 * is the weeks in a row so far, counting the week it started from.
 */
function climbs(workouts: StoredWorkout[]): { value: number; at: Milestone }[] {
  const weeks = new Map<string, Map<string, PerformedSet[]>>() // exercise → Monday → its sets
  for (const set of performedSets(workouts)) {
    const byWeek = weeks.get(set.exercise_id) ?? new Map<string, PerformedSet[]>()
    const monday = weekOf(set.performed_on)
    byWeek.set(monday, [...(byWeek.get(monday) ?? []), set])
    weeks.set(set.exercise_id, byWeek)
  }
  const order = new Map(workouts.map((w, i) => [w.id, i]))
  const found: { value: number; at: Milestone; order: number }[] = []
  for (const byWeek of weeks.values()) {
    let before: { monday: string; lifts: { weight: number; reps: number }[] } | null = null
    let run = 1
    for (const [monday, sets] of byWeek) {
      const lifts = sets.map((s) => ({ weight: s.weight_kg, reps: s.reps }))
      const climbed =
        before && nextMonday(before.monday) === monday
          ? sets.find((_, i) => detectPRs(lifts[i]!, null, before!.lifts).length > 0)
          : undefined
      run = climbed ? run + 1 : 1
      if (climbed) {
        const at = { day: climbed.performed_on, workoutId: climbed.workout_id }
        found.push({ value: run, at, order: order.get(climbed.workout_id)! })
      }
      before = { monday, lifts }
    }
  }
  return found.sort((a, b) => a.order - b.order)
}

/**
 * @param line your Gains Line settings (for the streak stamps)
 * @param library the ids of the library's exercises (for the explorer stamps)
 */
export function passport(
  workouts: StoredWorkout[],
  line: { target: number; depot: ReadonlySet<string>; today: string },
  library: ReadonlySet<string>,
): Passport {
  const done = chronological(workouts)
  const at = (w: StoredWorkout): Milestone => ({ day: w.performed_on, workoutId: w.id })

  // Rides
  const rides = done.map((w, i) => ({ value: i + 1, at: at(w) }))

  // Weight hauled, in tonnes, workout by workout
  const perWorkout = new Map<string, number>()
  for (const s of performedSets(done)) {
    perWorkout.set(s.workout_id, (perWorkout.get(s.workout_id) ?? 0) + s.weight_kg * s.reps)
  }
  let total = 0
  const hauled = done.map((w) => {
    total += perWorkout.get(w.id) ?? 0
    return { value: total / 1000, at: at(w) }
  })

  // PRs
  const prs = prWorkouts(done).map((m, i) => ({ value: i + 1, at: m }))

  // Streaks on the Gains Line: the week's target ride reaches the station
  const weeks = gainsLine(
    done.map((w) => w.performed_on),
    line.target,
    line.today,
    line.depot,
  ).weeks
  const lastOn = (day: string) => done.filter((w) => w.performed_on === day).at(-1)!
  const streaks = [...weeks.values()]
    .filter((w) => w.state === 'reached')
    .map((w) => ({ value: w.streak, at: at(lastOn(w.rides[line.target - 1]!)) }))

  // Climbing
  const climbing = climbs(done)

  // Explorer: each library exercise done for the first time (custom ones don't count)
  const explored = new Set<string>()
  const explorer: { value: number; at: Milestone }[] = []
  for (const s of performedSets(done)) {
    if (!library.has(s.exercise_id) || explored.has(s.exercise_id)) continue
    explored.add(s.exercise_id)
    explorer.push({ value: explored.size, at: { day: s.performed_on, workoutId: s.workout_id } })
  }

  const stamp = (
    kind: StampKind,
    goal: number,
    title: string,
    detail: string,
    reached: Milestone | null,
  ): Stamp => ({
    id: `${kind}-${goal}`,
    kind,
    goal,
    title,
    detail,
    earnedOn: reached?.day ?? null,
    earnedBy: reached?.workoutId ?? null,
  })

  const ridesAt = reachedAt(RIDES, rides)
  const hauledAt = reachedAt(
    HAULED.map(([t]) => t),
    hauled,
  )
  const prsAt = reachedAt(PRS, prs)
  const streaksAt = reachedAt(
    STREAKS.map(([n]) => n),
    streaks,
  )
  const climbingAt = reachedAt(CLIMBS, climbing)
  const [allAt, ...exploredAt] = reachedAt([library.size, ...EXPLORED], explorer)

  return {
    stamps: [
      ...RIDES.map((n, i) =>
        stamp('rides', n, n === 1 ? 'First ride' : `${n} rides`, 'finished workouts', ridesAt[i]!),
      ),
      ...HAULED.map(([t, what], i) => stamp('weight', t, `${t} t`, what, hauledAt[i]!)),
      ...PRS.map((n, i) =>
        stamp('prs', n, n === 1 ? 'First PR' : `${n} PRs`, 'personal records', prsAt[i]!),
      ),
      ...STREAKS.map(([n, what], i) => stamp('streak', n, `${n} in a row`, what, streaksAt[i]!)),
      ...CLIMBS.map((n, i) =>
        stamp('climbing', n, `${n} weeks`, 'one exercise stronger every week', climbingAt[i]!),
      ),
      ...EXPLORED.map((n, i) =>
        stamp('explorer', n, `${n} exercises`, 'different exercises', exploredAt[i]!),
      ),
      {
        ...stamp(
          'explorer',
          library.size,
          'The whole network',
          'every exercise in the library',
          allAt!,
        ),
        id: 'explorer-all',
        badge: 'All',
      },
    ],
    progress: {
      rides: rides.length,
      weight: Math.floor(total / 1000),
      prs: prs.length,
      streak: Math.max(0, ...streaks.map((s) => s.value)),
      climbing: Math.max(0, ...climbing.map((c) => c.value)),
      explorer: explored.size,
    },
  }
}
