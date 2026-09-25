/** Month grids for the calendar. Months are "YYYY-MM", days "YYYY-MM-DD" (local dates). */
import { localDateString } from './format'

export type Month = string

export function monthOf(isoDate: string): Month {
  return isoDate.slice(0, 7)
}

export function currentMonth(today = new Date()): Month {
  return monthOf(localDateString(today))
}

function parts(month: Month): [number, number] {
  const [y, m] = month.split('-').map(Number)
  return [y!, m! - 1]
}

export function isValidMonth(value: string | null): value is Month {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function shiftMonth(month: Month, delta: number): Month {
  const [y, m] = parts(month)
  return monthOf(localDateString(new Date(y, m + delta, 1)))
}

/** First and last day, inclusive (for the API's performed_from / performed_to). */
export function monthRange(month: Month): { from: string; to: string } {
  const [y, m] = parts(month)
  return {
    from: localDateString(new Date(y, m, 1)),
    to: localDateString(new Date(y, m + 1, 0)),
  }
}

/** Weeks (Monday first) of day strings; null pads the days outside the month. */
export function monthGrid(month: Month): (string | null)[][] {
  const [y, m] = parts(month)
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const leading = (new Date(y, m, 1).getDay() + 6) % 7 // Monday = 0
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => localDateString(new Date(y, m, i + 1))),
  ]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

export function monthLabel(month: Month): string {
  const [y, m] = parts(month)
  return monthFormat.format(new Date(y, m, 1))
}

/** Narrow weekday names, Monday first ("M T W T F S S" in English). */
export function weekdayLabels(): { short: string; long: string }[] {
  const short = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
  const long = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(2024, 0, 1 + i) // 1 Jan 2024 was a Monday
    return { short: short.format(day), long: long.format(day) }
  })
}
