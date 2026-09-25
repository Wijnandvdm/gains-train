/** 82.5 → "82.5", 85 → "85", 8.75 → "8.75" */
export function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100)
}

const volumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** 5675 → "5,675 kg" (separator per the user's locale) */
export function formatVolume(kg: number): string {
  return `${volumeFormat.format(kg)} kg`
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
