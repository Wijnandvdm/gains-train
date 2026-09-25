// Numbers look the same on every phone, whatever its language: a dot for decimals and a
// narrow no-break space between thousands ("11 664 kg", "65.8 kg"). A locale's "11.664"
// would read as eleven-point-something next to weights like "8.75".
const THOUSANDS = '\u202f' // narrow no-break space: never wraps mid-number

/** 11664 → "11 664", 82.5 → "82.5", 8.754 → "8.75" (at most `maxDecimals` decimals). */
export function formatNumber(value: number, maxDecimals = 2): string {
  const factor = 10 ** maxDecimals
  const rounded = Math.round(Math.abs(value) * factor) / factor
  const [whole, decimals] = String(rounded).split('.')
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS)
  return `${value < 0 && rounded !== 0 ? '-' : ''}${grouped}${decimals ? `.${decimals}` : ''}`
}

/** A weight without unit, for "85 × 10" and chart ticks: 82.5 → "82.5". */
export const formatKg = (kg: number): string => formatNumber(kg, 2)

/** 82.5 → "82.5 kg" */
export const formatWeight = (kg: number): string => `${formatKg(kg)} kg`

/** Estimated 1RMs are estimates: one decimal is plenty. 113.333 → "113.3 kg" */
export const formatE1rm = (kg: number): string => `${formatNumber(kg, 1)} kg`

/** Volume (weight × reps) in whole kilos: 11664.4 → "11 664 kg" */
export const formatVolume = (kg: number): string => `${formatNumber(kg, 0)} kg`

/** For text inputs: no thousands separator, so the value parses back. 1000 → "1000" */
export function weightInputText(kg: number | null): string {
  return kg === null ? '' : String(Math.round(kg * 100) / 100)
}

/** "85 × 10", "85 × –" or "– × 10" */
export function formatSet(weightKg: number | null, reps: number | null): string {
  return `${weightKg === null ? '–' : formatKg(weightKg)} × ${reps ?? '–'}`
}

/**
 * Parses an ISO date ("2026-09-15") as a *local* calendar date. `new Date("2026-09-15")`
 * would be UTC midnight, which shows as the previous day west of Greenwich.
 */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** Today's local date as "YYYY-MM-DD" (what the backend's performed_on expects). */
export function localDateString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const dayWithYearFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "Mon 15 Sep" (with the year when it isn't this year) */
export function formatDay(isoDate: string, now = new Date()): string {
  const date = parseLocalDate(isoDate)
  return (date.getFullYear() === now.getFullYear() ? dayFormat : dayWithYearFormat).format(date)
}

const shortDayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

/** "15 Sep" / "Sep 15" (per locale): for tight spaces. */
export function formatShortDay(isoDate: string): string {
  return shortDayFormat.format(parseLocalDate(isoDate))
}

/** Seconds → "1:05" (or "1:02:05" past an hour) */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** User input → kg with at most 2 decimals, or null if empty/invalid. Accepts "82,5". */
export function parseWeight(input: string): number | null {
  const value = Number(input.trim().replace(',', '.'))
  if (input.trim() === '' || !Number.isFinite(value) || value < 0 || value > 9999.99) return null
  return Math.round(value * 100) / 100
}

/** User input → whole reps, or null if empty/invalid. */
export function parseReps(input: string): number | null {
  const value = Number(input.trim())
  if (input.trim() === '' || !Number.isInteger(value) || value < 0 || value > 1000) return null
  return value
}
