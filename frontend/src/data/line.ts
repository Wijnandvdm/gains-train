/**
 * The Gains Line: a weekly streak, train style. Each week (Monday to Sunday) with at least
 * your target number of rides (finished workouts) reaches a station; stations in a row are
 * your streak. Tickets save a streak: one for every 4 stations in a row and one for every
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
const STATIONS_PER_TICKET = 4
export const WEEKLY_TARGETS = [1, 2, 3, 4, 5, 6, 7]

const STATIONS = [
  'Warm-Up Halt',
  'Pump Junction',
  'Protein Park',
  'Gainsborough',
  'Deadlift Dock',
  'Barbell Bridge',
  'PR Central',
  'Squat Rack Road',
  'Bicep Bay',
  'Tricep Terminal',
  'Lat Pulldown Loop',
  'Bench Press Bend',
  'Calf Raise Crossing',
  'Hamstring Heights',
  'Shoulder Summit',
  'Glute Gorge',
  'Core Corner',
  'Iron Isle',
  'Plate Load Plaza',
  'Gains Grand Central',
]

/** The name of the n-th station in a row (1-based); the line loops with a lap number. */
export function stationName(n: number): string {
  const lap = Math.floor((n - 1) / STATIONS.length)
  const name = STATIONS[(n - 1) % STATIONS.length]!
  return lap === 0 ? name : `${name} ${lap + 1}`
}

/** reached: a station · ticket: saved by a ticket · missed: fell short, streak over ·
 *  open: this week, not there yet · depot: parked, doesn't count ·
 *  before: before your first station ever */
export type WeekState = 'reached' | 'ticket' | 'missed' | 'open' | 'depot' | 'before'

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
}

/** Monday of the week the day is in. */
export function weekOf(isoDate: string): string {
  const d = parseLocalDate(isoDate)
  return localDateString(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)),
  )
}

export const nextMonday = (monday: string) => {
  const d = parseLocalDate(monday)
  return localDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))
}

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
      const earned = (streak % STATIONS_PER_TICKET === 0 ? 1 : 0) + (rides.length - target)
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
    nextTicketAt: (Math.floor(streak / STATIONS_PER_TICKET) + 1) * STATIONS_PER_TICKET,
    parkedUntil,
  }
}
