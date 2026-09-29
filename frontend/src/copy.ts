/**
 * The gains train's voice. Puns go where they add fun (greetings, milestones, celebrations),
 * never where clarity matters mid-set (buttons, numbers, errors).
 */

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
