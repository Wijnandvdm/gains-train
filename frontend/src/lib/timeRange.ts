/**
 * Time filters for a chart that grow with your data: only the ranges shorter than your
 * history (plus "All"), and none until there's more than 3 months to filter.
 */
import { localDateString, parseLocalDate } from './format'

export type TimeRange = { months: number | null; label: string } // null: all of it

const RANGES: TimeRange[] = [
  { months: 3, label: '3 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 60, label: '5 years' },
  { months: 120, label: '10 years' },
]
export const ALL: TimeRange = { months: null, label: 'All' }

/** The day `months` before `today` ("YYYY-MM-DD"). */
export function monthsBefore(today: string, months: number): string {
  const d = parseLocalDate(today)
  return localDateString(new Date(d.getFullYear(), d.getMonth() - months, d.getDate()))
}

/** The choices for a history starting on `firstDay`: [] when there's nothing to filter. */
export function rangeChoices(firstDay: string, today: string): TimeRange[] {
  const shorter = RANGES.filter((r) => firstDay < monthsBefore(today, r.months!))
  return shorter.length > 0 ? [...shorter, ALL] : []
}

/** What a chart opens on: a year once you have more than a year, else everything. */
export function defaultRange(choices: TimeRange[]): TimeRange {
  return choices.find((r) => r.months === 12) ?? ALL
}

/** Whether a day falls in the range (counted back from today). */
export const inRange = (day: string, range: TimeRange, today: string) =>
  range.months === null || day >= monthsBefore(today, range.months)
