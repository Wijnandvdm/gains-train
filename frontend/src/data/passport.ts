/**
 * The passport: stamps for milestones, worked out from your finished workouts (so restored
 * history counts, and nothing is stored). Each stamp knows when you earned it and with which
 * workout, so finishing a workout can announce the stamps it earned.
 */
import { localDateString, parseLocalDate, plural } from '../lib/format'
import { detectPRs } from '../workout/prs'
import type { WeightCount } from './dumbbells'
import { gainsLine, type LineWeek, MAX_TICKETS, nextMonday, weekOf } from './line'
import { type PerformedSet, performedSets } from './stats'
import type { StoredRoutine, StoredWorkout } from './types'

export type StampKind =
  | 'rides'
  | 'weight'
  | 'prs'
  | 'streak'
  | 'steam'
  | 'explorer'
  | 'hours'
  | 'express'
  | 'holiday'
  | 'features'
  | 'big3'
  | 'gear'
  | 'collection'

export type Stamp = {
  id: string
  kind: StampKind
  goal: number
  title: string
  detail: string
  /** How far towards the goal, when the kind's own progress doesn't say (7 of 10 workouts). */
  soFar?: number
  /** The big three: which of the lifts already got to this stamp's weight. */
  lifts?: string[]
  /** A line more to tell, when tapped (e.g. where the Orient Express ran). */
  note?: string
  /** What the stamp itself says, when not its number (e.g. "All"). */
  badge?: string
  /** The small word under it, when not the kind's (e.g. "commute"). */
  unit?: string
  /** Whether you can earn it again and again (a ×3 on it); false for one you earn once. */
  repeatable?: boolean
  /** Stamps you can earn again: how often so far (0 while not yet). */
  times?: number
  /** And the workout that earned it most recently (to announce it again). */
  againBy?: string | null
  /** The day you earned it; null while you're still working towards it. */
  earnedOn: string | null
  /** The workout that earned it. */
  earnedBy: string | null
}

export type Passport = {
  stamps: Stamp[]
  /** The workouts that set a personal record. */
  recordWorkouts: ReadonlySet<string>
  /**
   * How far you are, per kind: rides, tonnes hauled, PRs, best streak, most weeks at full steam,
   * exercises done; rides at odd hours, most days in a row, holidays and features stamped.
   */
  progress: Record<StampKind, number>
}

/** What the passport needs besides your workouts, for the Off the beaten track stamps. */
export type PassportExtras = {
  /** Exercises with exercise preferences (Seat 4, …). */
  preferences?: ReadonlySet<string>
  lastBackupAt?: string | null
  /** The library's exercises: their equipment and name (for the Train yard stamps). */
  exercises?: ReadonlyMap<string, GearInfo>
  /** Your routine as it is now (for Side-tracked: an exercise that isn't in the day). */
  routine?: StoredRoutine | null
}

/** Finished workouts, named after ever longer train rides; the last is the longest of all. */
const RIDES: [number, string, string?][] = [
  [1, 'Conductor in training'],
  [10, 'Regular commuter'],
  [25, 'Season ticket'],
  [50, 'Intercity'],
  [100, 'Glacier Express', 'Through the Swiss Alps from Zermatt to St. Moritz, over 291 bridges.'],
  [250, 'Orient Express', 'The legendary luxury train from Paris to Istanbul, across Europe.'],
  [500, 'Trans-Siberian', 'Moscow to Vladivostok: 9,289 km, the longest train ride in the world.'],
]
/**
 * The big three (bench press, squat, deadlift), each lifted at least this heavy. A triple-header
 * is a train pulled by three locomotives.
 */
const BIG_THREE_KG: [number, string][] = [
  [60, 'Branch line'],
  [80, 'Main line'],
  [100, 'Heavy freight'],
  [120, 'Iron horse'],
]
/** The library exercises that count for each of the three (sumo deadlifts count, as in a meet). */
const LIFT_NAMES = { bench: 'bench press', squat: 'squat', deadlift: 'deadlift' }
const BIG_THREE: Record<keyof typeof LIFT_NAMES, string[]> = {
  bench: ['Barbell_Bench_Press_-_Medium_Grip'],
  squat: ['Barbell_Full_Squat'],
  deadlift: ['Barbell_Deadlift', 'Sumo_Deadlift'],
}
/** Tonnes, compared to train cars (roughly: fully loaded, where it applies). */
const HAULED: [number, string][] = [
  [40, 'A passenger carriage'],
  [90, 'A loaded freight wagon'],
  [130, 'A locomotive'],
  [350, 'A commuter train'],
  [1000, 'A freight train'],
]
const PRS = [1, 10, 25, 50, 100]
/** Obstruction cleared: a PR after this many days without one on that exercise… */
const PLATEAU_DAYS = 8 * 7
/** …while you kept training it (sessions in between), so it was a plateau, not a break. */
const PLATEAU_SESSIONS = 3
const STREAKS: [number, string][] = [
  [4, 'weeks in a row'],
  [8, 'weeks in a row'],
  [12, 'weeks in a row'],
  [26, 'half a year in a row'],
  [52, 'a whole year in a row'],
]
/** Full steam ahead: weeks in a row that one exercise got stronger. */
const STEAM_WEEKS = [3, 4, 6, 8]
/** Different library exercises done; the last stamp is for all of them. */
const EXPLORED = [25, 50, 100, 200]
/** Express: days in a row with a workout. */
const EXPRESS_DAYS = [3, 5, 7]
/** What the Train yard stamps look at: an exercise's equipment and name. */
type GearInfo = { equipment: string | null; name: string }

/** Train yard: workouts with this kind of equipment, stamped again every GEAR_EVERY. */
const GEAR: {
  id: string
  title: string
  badge: string
  rule: string
  is: (e: GearInfo) => boolean
}[] = [
  {
    id: 'barbell',
    title: 'Barbell boarding',
    badge: 'Bar',
    rule: 'with a barbell exercise',
    is: (e) => e.equipment === 'barbell',
  },
  {
    id: 'dumbbell',
    title: 'Dumbbell depot',
    badge: 'DB',
    rule: 'with a dumbbell exercise',
    is: (e) => e.equipment === 'dumbbell',
  },
  {
    id: 'cable',
    title: 'Cable car connection',
    badge: 'Cable',
    rule: 'with a cable exercise',
    is: (e) => e.equipment === 'cable',
  },
  {
    // The library calls it a machine; its name says Smith.
    id: 'smith',
    title: 'Fixed track',
    badge: 'Smith',
    rule: 'with a Smith machine exercise (the bar runs on rails, like a train)',
    is: (e) => /smith machine/i.test(e.name),
  },
  {
    id: 'kettlebell',
    title: 'Kettlebell caboose',
    badge: 'KB',
    rule: 'with a kettlebell exercise (the caboose is the little car at the very end of a freight train, where the crew rode)',
    is: (e) => e.equipment === 'kettlebells',
  },
]
const GEAR_EVERY = 10
/** Railway roundhouse: this many weeks in a row parked in the depot. */
const ROUNDHOUSE_WEEKS = 4
/** Marathon line: a workout at least this long, start to finish. */
const MARATHON_HOURS = 2
/** Stamp collection: stamps for how many other stamps you have ("all", or all but `minus`). */
const COLLECTION: { goal: number | 'all'; minus?: number; title: string }[] = [
  { goal: 10, title: 'Trainspotter' },
  { goal: 50, title: 'Railway Baron' },
  { goal: 75, title: 'Track Tycoon' },
  { goal: 'all', minus: 5, title: 'Last stop before the terminus' },
  { goal: 'all', title: 'End of the line' },
]
/** Fast trains: your whole routine day in under this many minutes. */
const FAST_TRAINS: { id: string; title: string; minutes: number }[] = [
  { id: 'bullet', title: 'Bullet train', minutes: 30 },
  { id: 'maglev', title: 'Maglev', minutes: 20 },
]
/** …with at least this many sets of every exercise of the day (none skipped). */
const FAST_SETS = 2
/** Return ticket and Back on track: a break of at least this many days without any workout. */
const BREAK_DAYS = 28
/** Blue Monday line: this many Mondays in a row with a workout. */
const MONDAYS = 4
/** Burning coal: this much hauled in one workout, in kg (weight × reps). */
const COAL_KG = 10_000

type Milestone = { day: string; workoutId: string }
/** A time a repeat stamp was earned: a day, and the workout (none for a depot week or backup). */
type Moment = { day: string; workoutId: string | null }

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
 *
 * Breakthroughs (Obstruction cleared): a PR on an exercise that had none for PLATEAU_DAYS, while
 * you did it at least PLATEAU_SESSIONS times in between.
 */
function prWorkouts(workouts: StoredWorkout[]): {
  prs: Milestone[]
  breakthroughs: Moment[]
} {
  const history = new Map<string, { weight: number; reps: number }[]>()
  // Per exercise: the day of its last PR (or first session), and sessions since then.
  const stuck = new Map<string, { since: string; sessions: number }>()
  const found: Milestone[] = []
  const breakthroughs: Moment[] = []
  const sessions = new Map<string, PerformedSet[]>() // workout + exercise → its sets, in order
  for (const set of performedSets(workouts)) {
    const key = `${set.workout_id}|${set.exercise_id}`
    sessions.set(key, [...(sessions.get(key) ?? []), set])
  }
  for (const sets of sessions.values()) {
    const { exercise_id, workout_id, performed_on } = sets[0]!
    const before = history.get(exercise_id) ?? []
    const lifts = sets.map((s) => ({ weight: s.weight_kg, reps: s.reps }))
    const plateau = stuck.get(exercise_id)
    if (before.length > 0 && lifts.some((lift) => detectPRs(lift, null, before).length > 0)) {
      found.push({ day: performed_on, workoutId: workout_id })
      if (
        plateau &&
        plateau.sessions >= PLATEAU_SESSIONS &&
        daysBetween(plateau.since, performed_on) >= PLATEAU_DAYS &&
        breakthroughs.at(-1)?.workoutId !== workout_id // one per workout
      ) {
        breakthroughs.push({ day: performed_on, workoutId: workout_id })
      }
      stuck.set(exercise_id, { since: performed_on, sessions: 0 })
    } else if (plateau) {
      plateau.sessions += 1
    } else {
      stuck.set(exercise_id, { since: performed_on, sessions: 0 }) // the first session
    }
    history.set(exercise_id, [...before, ...lifts])
  }
  return { prs: found, breakthroughs }
}

const daysBetween = (from: string, to: string) =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000)

/**
 * Full steam ahead: one exercise getting stronger week after week. A week counts when one of its sets
 * beats everything done on that exercise the week before (heavier, a better estimated 1RM,
 * or more reps at that weight); a week without the exercise starts the count over. The value
 * is the weeks in a row so far, counting the week it started from.
 */
function fullSteam(workouts: StoredWorkout[]): { value: number; at: Milestone }[] {
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
      const stronger =
        before && nextMonday(before.monday) === monday
          ? sets.find((_, i) => detectPRs(lifts[i]!, null, before!.lifts).length > 0)
          : undefined
      run = stronger ? run + 1 : 1
      if (stronger) {
        const at = { day: stronger.performed_on, workoutId: stronger.workout_id }
        found.push({ value: run, at, order: order.get(stronger.workout_id)! })
      }
      before = { monday, lifts }
    }
  }
  return found.sort((a, b) => a.order - b.order)
}

// --- Stamps you can earn again ------------------------------------------------------------

/** The hour a workout started, on the phone's clock; null when unknown (imported workouts). */
const startHour = (w: StoredWorkout) => (w.started_at ? new Date(w.started_at).getHours() : null)

/** One moment per workout that did something, oldest first. */
const workoutsWhere = (done: StoredWorkout[], did: (w: StoredWorkout) => boolean): Moment[] =>
  done.filter(did).map((w) => ({ day: w.performed_on, workoutId: w.id }))

/** One moment per day that matches, with that day's first workout. */
function perDay(done: StoredWorkout[], matches: (day: string) => boolean): Moment[] {
  const seen = new Set<string>()
  return done.flatMap((w) => {
    if (seen.has(w.performed_on) || !matches(w.performed_on)) return []
    seen.add(w.performed_on)
    return [{ day: w.performed_on, workoutId: w.id }]
  })
}

const daysLater = (day: string, days: number) => {
  const date = parseLocalDate(day)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}
const nextDay = (day: string) => daysLater(day, 1)

/** Runs of days in a row with a workout, oldest first (each run: its days in order). */
function runsOfDays(done: StoredWorkout[]): string[][] {
  const runs: string[][] = []
  for (const day of new Set(done.map((w) => w.performed_on))) {
    const run = runs.at(-1)
    if (run && nextDay(run.at(-1)!) === day) run.push(day)
    else runs.push([day])
  }
  return runs
}

/**
 * Weeks (Monday to Sunday) with at least `goal` of these workouts, each counted once: stamped
 * with the workout that got there.
 */
function weeksReaching(moments: Moment[], goal: number): Moment[] {
  const perWeek = new Map<string, number>()
  return moments.filter((m) => {
    const n = (perWeek.get(weekOf(m.day)) ?? 0) + 1
    perWeek.set(weekOf(m.day), n)
    return n === goal
  })
}

/** Runs of `length` days in a row with one of these workouts, each run counted once. */
function daysInARow(moments: Moment[], length: number): Moment[] {
  const firstOfDay = new Map<string, Moment>()
  for (const m of moments) if (!firstOfDay.has(m.day)) firstOfDay.set(m.day, m)
  const found: Moment[] = []
  let run = 0
  let previous: string | null = null
  for (const [day, m] of firstOfDay) {
    run = previous && nextDay(previous) === day ? run + 1 : 1
    if (run === length) found.push(m)
    previous = day
  }
  return found
}

/** Easter Sunday as "MM-DD" (the Gregorian computus). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const monthDay = (day: string) => day.slice(5)
const yearOf = (day: string) => Number(day.slice(0, 4))
/** King's Day: 27 April, or the 26th when the 27th is a Sunday. */
const kingsDay = (year: number) => (new Date(year, 3, 27).getDay() === 0 ? '04-26' : '04-27')

const HOLIDAYS: {
  id: string
  title: string
  badge: string
  rule: string
  on: (day: string) => boolean
}[] = [
  {
    id: 'new-year',
    title: "New Year's Day",
    badge: 'NY',
    rule: "A workout on New Year's Day.",
    on: (d) => monthDay(d) === '01-01',
  },
  {
    id: 'easter',
    title: 'Easter',
    badge: 'Easter',
    rule: 'A workout on Easter Sunday or Easter Monday.',
    on: (d) => {
      const sunday = parseLocalDate(`${yearOf(d)}-${easterSunday(yearOf(d))}`)
      return d === localDateString(sunday) || d === nextDay(localDateString(sunday))
    },
  },
  {
    id: 'kings-day',
    title: "King's Day",
    badge: 'King',
    rule: "A workout on King's Day.",
    on: (d) => monthDay(d) === kingsDay(yearOf(d)),
  },
  {
    id: 'christmas',
    title: 'Christmas',
    badge: 'Xmas',
    rule: 'A workout on Christmas Day or Boxing Day.',
    on: (d) => monthDay(d) === '12-25' || monthDay(d) === '12-26',
  },
  {
    id: 'leap-day',
    title: 'Leap day',
    badge: '29/2',
    rule: 'A workout on 29 February, which only comes every four years.',
    on: (d) => monthDay(d) === '02-29',
  },
  {
    id: 'friday-13',
    title: 'Jinxed junction',
    badge: 'Fri13',
    rule: 'A workout on Friday the 13th: no bad luck under the bar.',
    on: (d) => d.slice(8) === '13' && parseLocalDate(d).getDay() === 5,
  },
  {
    id: 'pi-day',
    title: 'Pi platform',
    badge: '3.14',
    rule: 'A workout on 14 March: 3.14, Pi Day.',
    on: (d) => monthDay(d) === '03-14',
  },
  {
    id: 'halloween',
    title: 'Ghost train',
    badge: 'Boo',
    rule: 'A workout on Halloween (31 October): a ride on the ghost train.',
    on: (d) => monthDay(d) === '10-31',
  },
]

/**
 * @param line your Gains Line settings (for the streak stamps)
 * @param library the ids of the library's exercises (for the explorer stamps)
 */
export function passport(
  workouts: StoredWorkout[],
  line: { target: number; depot: ReadonlySet<string>; today: string },
  library: ReadonlySet<string>,
  count?: WeightCount,
  extras: PassportExtras = {},
): Passport {
  // Weeks in the depot earn nothing: their workouts don't count for any stamp (the depot
  // stamps themselves, In the depot and Railway roundhouse, come from the weeks, not workouts).
  const done = chronological(workouts).filter((w) => !line.depot.has(weekOf(w.performed_on)))
  const at = (w: StoredWorkout): Milestone => ({ day: w.performed_on, workoutId: w.id })

  // Rides
  const rides = done.map((w, i) => ({ value: i + 1, at: at(w) }))

  // Weight hauled, in tonnes, workout by workout
  const perWorkout = new Map<string, number>()
  for (const s of performedSets(done, undefined, count)) {
    perWorkout.set(
      s.workout_id,
      (perWorkout.get(s.workout_id) ?? 0) + s.weight_kg * s.reps * s.count,
    )
  }
  let total = 0
  const hauled = done.map((w) => {
    total += perWorkout.get(w.id) ?? 0
    return { value: total / 1000, at: at(w) }
  })

  // PRs
  const { prs: prMilestones, breakthroughs } = prWorkouts(done)
  const prs = prMilestones.map((m, i) => ({ value: i + 1, at: m }))

  // Streaks on the Gains Line: the ride that reaches the week's goal
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

  // Tickets: the workout behind the ride that earned one (or found no room for it)
  const rideOf = (week: LineWeek, ride: number): Moment => {
    const day = week.rides[ride]!
    const nth = week.rides.slice(0, ride + 1).filter((d) => d === day).length // 2nd ride that day…
    return { day, workoutId: done.filter((w) => w.performed_on === day)[nth - 1]!.id }
  }
  const ticketsEarned = [...weeks.values()].flatMap((week) =>
    week.ticketsEarned.map((t) => ({ ...rideOf(week, t.ride), held: t.held })),
  )
  const overbooked = [...weeks.values()].flatMap((week) =>
    week.ticketsOverbooked.map((ride) => rideOf(week, ride)),
  )

  // Full steam ahead
  const steam = fullSteam(done)

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

  // Stamps you can earn again: earned the first time, then counting.
  const again = (
    kind: StampKind,
    id: string,
    title: string,
    detail: string,
    moments: Moment[],
    looks: { badge?: string; unit?: string; goal?: number; once?: boolean } = {},
  ): Stamp => {
    const counted = looks.once ? moments.slice(0, 1) : moments
    return {
      id: `${kind}-${id}`,
      kind,
      goal: looks.goal ?? 1,
      title,
      detail,
      badge: looks.badge,
      unit: looks.unit,
      earnedOn: counted[0]?.day ?? null,
      earnedBy: counted[0]?.workoutId ?? null,
      times: counted.length,
      againBy: counted.at(-1)?.workoutId ?? null,
      repeatable: !looks.once,
    }
  }

  // Odd hours
  const night = workoutsWhere(done, (w) => {
    const hour = startHour(w)
    return hour !== null && (hour >= 21 || hour < 4)
  })
  const early = workoutsWhere(done, (w) => {
    const hour = startHour(w)
    return hour !== null && hour >= 4 && hour < 7
  })
  // Started between two clock times (minutes after midnight), on the phone's clock; for
  // weekdays only, not on a Saturday or Sunday
  const startedBetween = (from: number, to: number, weekdaysOnly = false) =>
    workoutsWhere(done, (w) => {
      if (!w.started_at) return false
      const start = new Date(w.started_at)
      if (weekdaysOnly && (start.getDay() === 0 || start.getDay() === 6)) return false
      const minutes = start.getHours() * 60 + start.getMinutes()
      return minutes >= from && minutes < to
    })
  const lunch = startedBetween(11 * 60 + 30, 13 * 60 + 30) // Lunch break line
  const rushHour = startedBetween(17 * 60, 20 * 60, true) // Rush hour: commuters, so weekdays

  // Marathon line: long workouts (only those with a start and an end time)
  const marathons = workoutsWhere(
    done,
    (w) =>
      !!w.started_at &&
      !!w.ended_at &&
      Date.parse(w.ended_at) - Date.parse(w.started_at) >= MARATHON_HOURS * 3_600_000,
  )

  // Express: each run of days in a row counts once per stamp it reaches
  const runs = runsOfDays(done)
  const firstOn = (day: string) => done.find((w) => w.performed_on === day)!.id
  const express = EXPRESS_DAYS.map((n) =>
    runs
      .filter((run) => run.length >= n)
      .map((run) => ({ day: run[n - 1]!, workoutId: firstOn(run[n - 1]!) })),
  )
  // Blue Monday line: Mondays in a row, each run counted once when it gets to MONDAYS
  const mondayRuns: string[][] = []
  for (const day of new Set(done.map((w) => w.performed_on))) {
    if (parseLocalDate(day).getDay() !== 1) continue
    const run = mondayRuns.at(-1)
    if (run && daysLater(run.at(-1)!, 7) === day) run.push(day)
    else mondayRuns.push([day])
  }
  const blueMondays = mondayRuns
    .filter((run) => run.length >= MONDAYS)
    .map((run) => ({ day: run[MONDAYS - 1]!, workoutId: firstOn(run[MONDAYS - 1]!) }))

  // Double decker: a second workout on a day (stamped with that second one), once per day
  const doubleDeckers: Moment[] = []
  done.forEach((w, i) => {
    const earlier = done.slice(0, i).filter((o) => o.performed_on === w.performed_on).length
    if (earlier === 1) doubleDeckers.push({ day: w.performed_on, workoutId: w.id })
  })

  // Return ticket: the first workout after a break of BREAK_DAYS without any (depot weeks or
  // not); Back on track: that week also reaches your weekly goal
  const counting = new Set(done.map((w) => w.id)) // not in a depot week
  const returns: Moment[] = []
  const backOnTrack: Moment[] = []
  const everything = chronological(workouts)
  everything.forEach((w, i) => {
    const before = everything[i - 1]
    if (!before || daysBetween(before.performed_on, w.performed_on) < BREAK_DAYS) return
    if (!counting.has(w.id)) return
    returns.push({ day: w.performed_on, workoutId: w.id })
    const thatWeek = done.filter((o) => weekOf(o.performed_on) === weekOf(w.performed_on))
    const reached = thatWeek[line.target - 1]
    if (reached) backOnTrack.push({ day: reached.performed_on, workoutId: reached.id })
  })

  // Weekend express: Saturday and Sunday of one weekend, stamped on the Sunday
  const trainedOn = new Set(done.map((w) => w.performed_on))
  const weekends = perDay(done, (day) => {
    if (parseLocalDate(day).getDay() !== 0) return false
    const saturday = parseLocalDate(day)
    saturday.setDate(saturday.getDate() - 1)
    return trainedOn.has(localDateString(saturday))
  })

  // Burning coal: a big haul in one workout
  const coal = workoutsWhere(done, (w) => (perWorkout.get(w.id) ?? 0) >= COAL_KG)

  // Double track: twice the weight you started an exercise with (its first session's heaviest
  // set), once per exercise
  const starts = new Map<string, { workout: string; kg: number; doubled: boolean }>()
  const doubled: Moment[] = []
  for (const s of performedSets(done)) {
    const start = starts.get(s.exercise_id)
    if (!start)
      starts.set(s.exercise_id, { workout: s.workout_id, kg: s.weight_kg, doubled: false })
    else if (s.workout_id === start.workout) start.kg = Math.max(start.kg, s.weight_kg)
    else if (!start.doubled && start.kg > 0 && s.weight_kg >= 2 * start.kg) {
      start.doubled = true
      doubled.push({ day: s.performed_on, workoutId: s.workout_id })
    }
  }

  // Holiday specials, and your gym birthday: a ride on the date of your very first one
  const first = done[0]?.performed_on
  const birthdays = first
    ? perDay(done, (d) => monthDay(d) === monthDay(first) && yearOf(d) > yearOf(first))
    : []
  // Polar Express: 24, 25 and 26 December all trained, once a year (stamped on the 26th)
  const polar = perDay(
    done,
    (d) =>
      monthDay(d) === '12-26' &&
      trainedOn.has(`${yearOf(d)}-12-24`) &&
      trainedOn.has(`${yearOf(d)}-12-25`),
  )
  const holidays = [
    ...HOLIDAYS.map((h) =>
      again('holiday', h.id, h.title, h.rule, perDay(done, h.on), { badge: h.badge }),
    ),
    again(
      'holiday',
      'polar-express',
      'Polar Express',
      'A workout on each of 24, 25 and 26 December: all of Christmas on the rails.',
      polar,
      { badge: 'Polar', unit: 'express' },
    ),
    again(
      'holiday',
      'birthday',
      'Gym birthday',
      'A workout on the date you started with the app (your very first ride), a year or more later. Not your own birthday: the day your gains train first left the station.',
      birthdays,
      { badge: 'Gym', unit: 'birthday' },
    ),
  ]

  // Off the beaten track
  const sets = performedSets(done, undefined, count)

  // Fast trains: a routine workout with every exercise of its day done (at least FAST_SETS sets
  // each), from start to finish in under the train's minutes
  const fullRoute = (w: StoredWorkout) => {
    const day = extras.routine?.days.find((d) => d.id === w.routine_day_id)
    if (!day || day.exercises.length === 0) return false
    const done = new Map<string, number>()
    for (const s of sets) {
      if (s.workout_id === w.id) done.set(s.exercise_id, (done.get(s.exercise_id) ?? 0) + 1)
    }
    return day.exercises.every((e) => (done.get(e.exercise_id) ?? 0) >= FAST_SETS)
  }
  const minutesOf = (w: StoredWorkout) =>
    w.started_at && w.ended_at
      ? (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60_000
      : Infinity
  const fast = FAST_TRAINS.map((f) =>
    again(
      'hours',
      f.id,
      f.title,
      `Your whole routine day (at least ${FAST_SETS} sets of every exercise, none skipped) in under ${f.minutes} minutes, from start to finish.`,
      workoutsWhere(done, (w) => minutesOf(w) < f.minutes && fullRoute(w)),
      { badge: `<${f.minutes}`, unit: 'min' },
    ),
  )
  const workoutsWith = (did: (s: PerformedSet) => boolean): Moment[] => {
    const ids = new Set(sets.filter(did).map((s) => s.workout_id))
    return workoutsWhere(done, (w) => ids.has(w.id))
  }
  const preferences = extras.preferences ?? new Set<string>()
  const backupDay = extras.lastBackupAt ? localDateString(new Date(extras.lastBackupAt)) : null
  // Depot weeks that have started (their Mondays), oldest first; and runs of them in a row
  const depotWeeks = [...line.depot].filter((d) => d <= line.today).sort()
  const roundhouse: Moment[] = []
  let parked = 0
  depotWeeks.forEach((monday, i) => {
    parked = i > 0 && daysLater(depotWeeks[i - 1]!, 7) === monday ? parked + 1 : 1
    if (parked === ROUNDHOUSE_WEEKS) roundhouse.push({ day: monday, workoutId: null })
  })

  const features = [
    again(
      'features',
      'routine',
      'Laid the tracks',
      'Built your own routine and did your first workout from it.',
      workoutsWhere(done, (w) => w.routine_day_id !== null),
      { badge: 'Route', unit: 'planned', once: true },
    ),
    again(
      'features',
      'side-tracked',
      'Side-tracked',
      "In a workout from your routine, an exercise that isn't in that routine day.",
      workoutsWhere(done, (w) => {
        const day = extras.routine?.days.find((d) => d.id === w.routine_day_id)
        if (!day) return false
        const planned = new Set(day.exercises.map((e) => e.exercise_id))
        return sets.some((s) => s.workout_id === w.id && !planned.has(s.exercise_id))
      }),
      { badge: 'Side', unit: 'tracked', once: true },
    ),
    again(
      'features',
      'own',
      'Your own exercise',
      'Logged an exercise you made yourself.',
      workoutsWith((s) => s.exercise_id.startsWith('custom-')),
      { badge: 'Own', unit: 'exercise', once: true },
    ),
    again(
      'features',
      'preferences',
      'Set up just right',
      'Logged an exercise with its exercise preferences (Seat 4, …).',
      workoutsWith((s) => preferences.has(s.exercise_id)),
      { badge: 'Seat', unit: 'set up', once: true },
    ),
    again(
      'features',
      'dumbbells',
      'Two dumbbells',
      'Logged two dumbbells as the weight of each.',
      workoutsWith((s) => s.count === 2),
      { badge: '2×', unit: 'each', once: true },
    ),
    again(
      'features',
      'depot',
      'In the depot',
      'Parked a week in the depot (holiday or injury: the streak waits).',
      depotWeeks.map((day) => ({ day, workoutId: null })),
      { badge: 'Depot', unit: 'parked', once: true },
    ),
    again(
      'features',
      'roundhouse',
      'Railway roundhouse',
      `${ROUNDHOUSE_WEEKS} weeks in a row in the depot: a long stay in the roundhouse, the round shed where locomotives rest and get repaired.`,
      roundhouse,
      { badge: 'Round', unit: 'house', once: true },
    ),
    again(
      'features',
      'backup',
      'Safe and sound',
      'Made a backup of your workouts (Settings → Backup).',
      backupDay ? [{ day: backupDay, workoutId: null }] : [],
      { badge: 'Safe', unit: 'backup', once: true },
    ),
  ]

  // The big three: the lightest of your three bests, set by set
  const best = { bench: 0, squat: 0, deadlift: 0 }
  const lifts = Object.entries(BIG_THREE) as [keyof typeof best, string[]][]
  const bigThree: { value: number; at: Milestone }[] = []
  for (const s of sets) {
    const lift = lifts.find(([, ids]) => ids.includes(s.exercise_id))?.[0]
    if (!lift || s.weight_kg <= best[lift]) continue
    best[lift] = s.weight_kg
    bigThree.push({
      value: Math.min(best.bench, best.squat, best.deadlift),
      at: { day: s.performed_on, workoutId: s.workout_id },
    })
  }
  const bigThreeAt = reachedAt(
    BIG_THREE_KG.map(([kg]) => kg),
    bigThree,
  )

  // Train yard: every GEAR_EVERY-th workout with that kind of equipment
  const usedPerGear = GEAR.map((g) =>
    workoutsWith((s) => {
      const exercise = extras.exercises?.get(s.exercise_id)
      return exercise !== undefined && g.is(exercise)
    }),
  )
  const gear = GEAR.map((g, gi) => {
    const used = usedPerGear[gi]!
    return {
      ...again(
        'gear',
        g.id,
        g.title,
        `${GEAR_EVERY} workouts ${g.rule}. Every ${GEAR_EVERY} more counts again.`,
        used.filter((_, i) => (i + 1) % GEAR_EVERY === 0),
        { badge: g.badge, unit: `${GEAR_EVERY} rides`, goal: GEAR_EVERY },
      ),
      soFar: used.length,
    }
  })

  // Network navigator: every kind of equipment in one week, or in one month (each once)
  const order = new Map(done.map((w, i) => [w.id, i])) // a workout's place in time
  const navigator = (period: (day: string) => string): Moment[] => {
    const kinds = new Map<string, Set<string>>() // period → the kinds done in it so far
    const found: Moment[] = []
    const moments = usedPerGear
      .flatMap((used, gi) => used.map((m) => ({ ...m, kind: GEAR[gi]!.id })))
      .sort((a, b) => order.get(a.workoutId!)! - order.get(b.workoutId!)!)
    for (const m of moments) {
      const seen = kinds.get(period(m.day)) ?? new Set<string>()
      kinds.set(period(m.day), seen)
      if (seen.has(m.kind)) continue
      seen.add(m.kind)
      if (seen.size === GEAR.length) found.push({ day: m.day, workoutId: m.workoutId })
    }
    return found
  }
  // The month first: it's the easier one.
  const navigators = [
    again(
      'gear',
      'navigator-month',
      'Network newbie',
      'Every kind in the Train yard (barbell, dumbbells, cable, Smith machine and kettlebell) in one calendar month.',
      navigator((day) => day.slice(0, 7)),
      { badge: 'All 5', unit: 'month' },
    ),
    again(
      'gear',
      'navigator-week',
      'Network navigator',
      'Every kind in the Train yard (barbell, dumbbells, cable, Smith machine and kettlebell) in one week.',
      navigator(weekOf),
      { badge: 'All 5', unit: 'week' },
    ),
  ]

  const ridesAt = reachedAt(
    RIDES.map(([n]) => n),
    rides,
  )
  const hauledAt = reachedAt(
    HAULED.map(([t]) => t),
    hauled,
  )
  const prsAt = reachedAt(PRS, prs)
  const streaksAt = reachedAt(
    STREAKS.map(([n]) => n),
    streaks,
  )
  const steamAt = reachedAt(STEAM_WEEKS, steam)
  const [allAt, ...exploredAt] = reachedAt([library.size, ...EXPLORED], explorer)

  const stamps: Stamp[] = [
    ...RIDES.map(([n, name, note], i) => ({
      ...stamp('rides', n, name, plural(n, 'finished workout'), ridesAt[i]!),
      note,
    })),
    ...HAULED.map(([t, what], i) => stamp('weight', t, `${t} t`, what, hauledAt[i]!)),
    again(
      'weight',
      'coal',
      'Burning coal',
      `${COAL_KG / 1000} tonnes or more in a single workout (weight × reps).`,
      coal,
      { badge: `${COAL_KG / 1000}t`, unit: 'in one go' },
    ),
    ...PRS.map((n, i) =>
      stamp('prs', n, n === 1 ? 'First PR' : `${n} PRs`, 'personal records', prsAt[i]!),
    ),
    again(
      'prs',
      'plateau',
      'Obstruction cleared',
      `A PR on an exercise that hadn't had one for ${PLATEAU_DAYS / 7} weeks or more, while you kept training it: through the plateau, the obstruction is off the track.`,
      breakthroughs,
      { badge: 'Clear', unit: 'line' },
    ),
    again(
      'prs',
      'double',
      'Double track',
      'Twice the weight you started an exercise with (the heaviest set of its first session). Counts once per exercise.',
      doubled,
      { badge: 'Double', unit: 'track' },
    ),
    ...STREAKS.map(([n, what], i) => stamp('streak', n, `${n} in a row`, what, streaksAt[i]!)),
    again(
      'streak',
      'ticket-1',
      'Ticket to ride',
      'Your first ticket: earned with 4 weeks in a row on your weekly goal, or a bonus ride above it. A ticket saves your streak when a week falls short.',
      ticketsEarned,
      { badge: '1st', unit: 'ticket', once: true },
    ),
    again(
      'streak',
      'ticket-2',
      'Two-way ticket',
      `${MAX_TICKETS} tickets in your pocket at once, the most you can hold.`,
      ticketsEarned.filter((t) => t.held >= MAX_TICKETS),
      { badge: String(MAX_TICKETS), unit: 'tickets', once: true },
    ),
    again(
      'streak',
      'overbooked',
      'Overbooked',
      `You earned another ticket while you already held ${MAX_TICKETS}: no room for it.`,
      overbooked,
      { badge: 'Over', unit: 'booked' },
    ),
    ...STEAM_WEEKS.map((n, i) =>
      stamp('steam', n, `${n} weeks`, 'one exercise stronger every week', steamAt[i]!),
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
    ...BIG_THREE_KG.map(([kg, name], i) => ({
      ...stamp('big3', kg, name, `bench, squat and deadlift at ${kg} kg`, bigThreeAt[i]!),
      lifts: lifts.filter(([lift]) => best[lift] >= kg).map(([lift]) => LIFT_NAMES[lift]),
    })),
    ...[
      {
        id: 'night',
        name: 'Night train',
        when: 'started from 21:00 (or in the small hours)',
        badge: 'Night',
        unit: 'train',
        days: 'nights',
        moments: night,
      },
      {
        id: 'early',
        name: 'Early commute',
        when: 'started before 7:00 in the morning',
        badge: 'Early',
        unit: 'commute',
        days: 'mornings',
        moments: early,
      },
    ].flatMap((o) => [
      // Once: the first one unlocks it.
      again('hours', o.id, o.name, `Your first workout ${o.when}.`, o.moments, {
        badge: o.badge,
        unit: o.unit,
        once: true,
      }),
      again(
        'hours',
        `${o.id}-week`,
        `${o.name} week`,
        `Your weekly goal (${plural(line.target, 'workout')}) reached in one week with workouts ${o.when}.`,
        weeksReaching(o.moments, line.target),
        { badge: o.badge, unit: 'week' },
      ),
      again(
        'hours',
        `${o.id}-7`,
        `${o.name}, 7 in a row`,
        `Workouts ${o.when}, 7 days in a row.`,
        daysInARow(o.moments, 7),
        { badge: '7', unit: o.days },
      ),
    ]),
    again(
      'hours',
      'marathon',
      'Marathon line',
      `A workout of ${MARATHON_HOURS} hours or more, from start to finish.`,
      marathons,
      { badge: `${MARATHON_HOURS}h+`, unit: 'marathon' },
    ),
    ...fast,
    again(
      'hours',
      'lunch',
      'Lunch break line',
      'A workout started between 11:30 and 13:30: a lunch break well spent.',
      lunch,
      { badge: 'Lunch', unit: 'break' },
    ),
    again(
      'hours',
      'rush-hour',
      'Rush hour',
      'A workout started between 17:00 and 20:00 on a weekday, with the commuters.',
      rushHour,
      { badge: 'Rush', unit: 'hour' },
    ),
    ...EXPRESS_DAYS.map((n, i) =>
      again(
        'express',
        String(n),
        `${n} days in a row`,
        `Workouts on ${n} days in a row.`,
        express[i]!,
        { goal: n },
      ),
    ),
    again(
      'express',
      'weekend',
      'Weekend express',
      'A workout on both Saturday and Sunday of one weekend.',
      weekends,
      { badge: 'Sa+Su', unit: 'weekend' },
    ),
    again(
      'express',
      'mondays',
      'Blue Monday line',
      `A workout on ${MONDAYS} Mondays in a row: the line that beats the Monday blues.`,
      blueMondays,
      { badge: 'Blue', unit: 'monday' },
    ),
    again(
      'express',
      'return',
      'Return ticket',
      `Your first workout after a break of ${BREAK_DAYS / 7} weeks or more.`,
      returns,
      { badge: 'Return', unit: 'ticket' },
    ),
    again(
      'express',
      'back-on-track',
      'Back on track',
      `After a break of ${BREAK_DAYS / 7} weeks or more, your weekly goal reached in the week you came back.`,
      backOnTrack,
      { badge: 'Back', unit: 'on track' },
    ),
    again('express', 'double-decker', 'Double decker', 'Two workouts on one day.', doubleDeckers, {
      badge: '2',
      unit: 'in a day',
    }),
    ...holidays,
    ...features,
    ...gear,
    ...navigators,
  ]

  // Stamp collection: the moment you got your 10th, 50th, … stamp (these don't count themselves)
  const place = new Map(done.map((w, i) => [w.id, i]))
  const collected = stamps
    .filter((s) => s.earnedOn)
    .sort(
      (a, b) =>
        a.earnedOn!.localeCompare(b.earnedOn!) ||
        (a.earnedBy ? place.get(a.earnedBy)! : -1) - (b.earnedBy ? place.get(b.earnedBy)! : -1),
    )
  const collection = COLLECTION.map((c): Stamp => {
    const goal = c.goal === 'all' ? stamps.length - (c.minus ?? 0) : c.goal
    const reached = collected[goal - 1]
    const all = c.goal === 'all' && !c.minus
    return {
      id: `collection-${c.goal === 'all' ? `all${c.minus ? `-${c.minus}` : ''}` : goal}`,
      kind: 'collection',
      goal,
      title: c.title,
      detail: all ? 'every other stamp in your passport' : `${goal} stamps in your passport`,
      badge: all ? 'All' : undefined,
      earnedOn: reached?.earnedOn ?? null,
      earnedBy: reached?.earnedBy ?? null,
    }
  })

  return {
    stamps: [...stamps, ...collection],
    recordWorkouts: new Set(prMilestones.map((m) => m.workoutId)),
    progress: {
      rides: rides.length,
      weight: Math.floor(total / 1000),
      prs: prs.length,
      streak: Math.max(0, ...streaks.map((s) => s.value)),
      steam: Math.max(0, ...steam.map((c) => c.value)),
      explorer: explored.size,
      hours: night.length + early.length,
      express: Math.max(0, ...runs.map((run) => run.length)),
      holiday: holidays.filter((s) => s.earnedOn).length,
      features: features.filter((s) => s.earnedOn).length,
      big3: Math.min(best.bench, best.squat, best.deadlift),
      gear: [...gear, ...navigators].filter((s) => s.earnedOn).length,
      collection: collected.length,
    },
  }
}
