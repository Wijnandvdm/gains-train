/**
 * The gains train's voice. Puns go where they add fun (greetings, milestones, celebrations),
 * never where clarity matters mid-set (buttons, numbers, errors).
 */
import type { WorkoutSummary } from './data/types'
import { localDateString } from './lib/format'

export const TAGLINE = 'All aboard the gains train!'

/** Shown after each logged set, rotating. */
export const CHEERS = [
  "You're well on track!",
  'Full steam ahead!',
  'Choo choo! 💨',
  'Chugging along nicely.',
  'Keep those wheels turning!',
  'Right on schedule.',
  'Next stop: gains.',
  'Picking up speed!',
] as const

/** The cheer after the n-th set of a workout (deterministic, so it doesn't flicker). */
export function cheer(setsDone: number): string {
  return CHEERS[(setsDone - 1 + CHEERS.length) % CHEERS.length]!
}

/** Finished workouts in the last 7 days (today included). */
export function ridesThisWeek(workouts: WorkoutSummary[], today = new Date()): number {
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 6)
  const from = localDateString(weekAgo)
  return workouts.filter((w) => w.status === 'completed' && w.performed_on >= from).length
}

export function weekMessage(rides: number): string {
  if (rides === 0) return 'First ride of the week. All aboard!'
  if (rides === 1) return '1 ride this week. Keep the train rolling!'
  return `${rides} rides this week. You're well on track!`
}
