/**
 * The Gains Line: a weekly streak, train style. Each week (Monday to Sunday) with at least
 * your weekly goal of rides (finished workouts) is a week reached; weeks reached in a row are
 * your streak. Tickets save a streak: one for every 4 weeks in a row and one for every
 * bonus ride above the target, holding at most 2. A week that falls short uses a ticket
 * automatically; without one, the streak starts over. Weeks parked in the depot (holiday,
 * injury) that fall short are skipped: no ticket spent, the streak just waits.
 *
 * Everything is worked out from your workouts, so imported history counts and editing or
 * deleting a workout simply updates the line.
 */
import { localDateString, parseLocalDate } from '../lib/format'

export const DEFAULT_WEEKLY_TARGET = 3
export const MAX_TICKETS = 2
export const WEEKS_PER_TICKET = 4
export const WEEKLY_TARGETS = [1, 2, 3, 4, 5, 6, 7]

/** Weeks in a row worth celebrating: close together at first, then every half year. */
const MILESTONES: [number, string][] = [
  [2, 'two weeks'],
  [4, 'a month'],
  [8, 'two months'],
  [13, 'three months'],
  [26, 'half a year'],
  [39, 'nine months'],
  [52, 'a year'],
]
const HALF_YEAR = 26

/** The name of a milestone (a number of weeks in a row), e.g. "half a year", "two years". */
export function milestoneName(weeks: number): string {
  const named = MILESTONES.find(([w]) => w === weeks)
  if (named) return named[1]
  const years = weeks / 52
  const whole = Math.floor(years)
  const count = ['', 'one', 'two', 'three', 'four', 'five'][whole] ?? String(whole)
  if (years === whole) return `${count} years`
  return whole === 1 ? 'a year and a half' : `${count} and a half years`
}

/** Whether this many weeks in a row is a milestone. */
export const isMilestone = (weeks: number) =>
  MILESTONES.some(([w]) => w === weeks) || (weeks > 52 && weeks % HALF_YEAR === 0)

/** The next milestone after this many weeks in a row. */
export function nextMilestone(weeks: number): number {
  const named = MILESTONES.find(([w]) => w > weeks)
  if (named) return named[0]
  return (Math.floor(weeks / HALF_YEAR) + 1) * HALF_YEAR
}

/** reached: the week's goal reached · ticket: saved by a ticket · missed: fell short, streak over ·
 *  open: this week, not there yet · depot: parked, doesn't count ·
 *  before: before your first week reached ever */
type WeekState = 'reached' | 'ticket' | 'missed' | 'open' | 'depot' | 'before'

export type LineWeek = {
  /** The week's Monday, "YYYY-MM-DD". */
  monday: string
  /** Days of the week's rides (one entry per ride), oldest first. */
  rides: string[]
  state: WeekState
  /** The streak after this week. */
  streak: number
}

export type GainsLine = {
  target: number
  /** From the week of your first ride up to this week, by Monday. */
  weeks: Map<string, LineWeek>
  thisWeek: LineWeek
  lastWeek: LineWeek | null
  streak: number
  tickets: number
  /** The streak length that earns the next ticket. */
  nextTicketAt: number
  /** The Sunday the depot stay that includes this week ends; null when not parked. */
  parkedUntil: string | null
  /** The day this was worked out for, "YYYY-MM-DD". */
  today: string
}

/** Monday of the week the day is in. */
export function weekOf(isoDate: string): string {
  const d = parseLocalDate(isoDate)
  return localDateString(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)),
  )
}

const addWeeks = (monday: string, weeks: number) => {
  const d = parseLocalDate(monday)
  return localDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * weeks))
}
export const nextMonday = (monday: string) => addWeeks(monday, 1)
export const previousMonday = (monday: string) => addWeeks(monday, -1)

/** Whether the week is part of the streak: reached, saved by a ticket, or parked mid-streak. */
export const onTheLine = (week: LineWeek | undefined) =>
  week?.state === 'reached' ||
  week?.state === 'ticket' ||
  (week?.state === 'depot' && week.streak > 0)

/**
 * @param rideDays performed_on of every finished workout, in any order
 * @param depot Mondays of the weeks parked in the depot
 */
export function gainsLine(
  rideDays: string[],
  target: number,
  today = localDateString(),
  depot: ReadonlySet<string> = new Set(),
): GainsLine {
  const current = weekOf(today)
  const byWeek = new Map<string, string[]>()
  for (const day of [...rideDays].sort()) {
    const monday = weekOf(day)
    byWeek.set(monday, [...(byWeek.get(monday) ?? []), day])
  }

  const weeks = new Map<string, LineWeek>()
  let streak = 0
  let tickets = 0
  let started = false
  const first = [...byWeek.keys()][0]
  for (let monday = first ?? current; monday <= current; monday = nextMonday(monday)) {
    const rides = byWeek.get(monday) ?? []
    let state: WeekState
    if (rides.length >= target) {
      state = 'reached'
      started = true
      streak += 1
      const earned = (streak % WEEKS_PER_TICKET === 0 ? 1 : 0) + (rides.length - target)
      tickets = Math.min(MAX_TICKETS, tickets + earned)
    } else if (depot.has(monday)) {
      state = 'depot' // parked: skipped, the streak waits
    } else if (monday === current) {
      state = 'open' // the week isn't over yet
    } else if (!started) {
      state = 'before'
    } else if (tickets > 0) {
      state = 'ticket'
      tickets -= 1
    } else {
      state = 'missed'
      streak = 0
    }
    weeks.set(monday, { monday, rides, state, streak })
  }

  let parkedUntil: string | null = null
  for (let monday = current; depot.has(monday); monday = nextMonday(monday)) {
    const d = parseLocalDate(monday)
    parkedUntil = localDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6))
  }

  const all = [...weeks.values()]
  return {
    target,
    weeks,
    thisWeek: all.at(-1)!,
    lastWeek: all.at(-2) ?? null,
    streak,
    tickets,
    nextTicketAt: (Math.floor(streak / WEEKS_PER_TICKET) + 1) * WEEKS_PER_TICKET,
    parkedUntil,
    today,
  }
}
