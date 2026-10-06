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

/**
 * The line the train drives: the Trans-Siberian Railway, Moscow to Vladivostok, with the km
 * from Moscow (train 002M's timetable, via en.wikipedia.org/wiki/Trans-Siberian_Railway).
 * Each station in a row is the next stop; at the end of the line the train heads back.
 */
const ROUTE: [string, number][] = [
  ['Moscow', 0],
  ['Vladimir', 210],
  ['Nizhny Novgorod', 461],
  ['Kirov', 917],
  ['Perm', 1397],
  ['Yekaterinburg', 1816],
  ['Tyumen', 2104],
  ['Omsk', 2676],
  ['Novosibirsk', 3303],
  ['Krasnoyarsk', 4065],
  ['Taishet', 4483],
  ['Irkutsk', 5153],
  ['Ulan-Ude', 5609],
  ['Chita', 6166],
  ['Birobidzhan', 8312],
  ['Khabarovsk', 8493],
  ['Ussuriysk', 9147],
  ['Vladivostok', 9289],
]
const LEGS = ROUTE.length - 1
const LENGTH = ROUTE[LEGS]![1]

export type Station = {
  name: string
  /** The km the train has driven to get here, all trips together. */
  driven: number
  /** The leg that ends here: where it came from, and how far that is. */
  from: string
  leg: number
  /** Where the train heads next (the end of the line it's driving towards), and how far. */
  towards: string
  left: number
}

/** The n-th station in a row (0: the start, in Moscow). */
export function station(n: number): Station {
  const at = (i: number) => {
    const trip = Math.floor(i / LEGS) // even: towards Vladivostok; odd: back to Moscow
    const stop = i % LEGS
    const index = trip % 2 === 0 ? stop : LEGS - stop
    return { trip, index, km: ROUTE[index]![1] }
  }
  const here = at(n)
  const previous = at(Math.max(0, n - 1))
  const outbound = here.trip % 2 === 0 // the trip it's on now, or starts here
  return {
    name: ROUTE[here.index]![0],
    driven: here.trip * LENGTH + (outbound ? here.km : LENGTH - here.km),
    from: ROUTE[previous.index]![0],
    leg: Math.abs(here.km - previous.km),
    towards: outbound ? ROUTE[LEGS]![0] : ROUTE[0]![0],
    left: outbound ? LENGTH - here.km : here.km,
  }
}

/** reached: a station · ticket: saved by a ticket · missed: fell short, streak over ·
 *  open: this week, not there yet · depot: parked, doesn't count ·
 *  before: before your first station ever */
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

/** Whether the week is part of a line: a station, saved by a ticket, or parked mid-streak. */
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
    today,
  }
}
