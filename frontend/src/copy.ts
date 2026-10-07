import { formatVolume } from './lib/format'

/**
 * The gains train's voice: every pun in the app, by screen, so they're easy to see (and
 * change) together. Puns go where they add fun (greetings, milestones, celebrations), never
 * where clarity matters mid-set (numbers, errors). The Gains Line's own words (stations,
 * tickets, the depot) are game rules, not puns: they live with those rules in data/line.ts.
 */

// --- Setup (first open) ---------------------------------------------------------------------

export const SETUP = {
  title: "Let's lay the tracks",
  intro: 'Two questions, then every workout is one tap per set. Choo choo.',
  start: 'All aboard! 🚂',
  starting: 'Laying tracks…',
}

// --- Workout --------------------------------------------------------------------------------

export const WORKOUT = {
  /** Above the routine day that's up next, or another day you picked. */
  nextDay: 'Next stop',
  otherDay: 'Changing tracks',
  /** Every planned set is done. */
  planDone: "End of the line! 🚂 That's everything you planned.",
  /** The banner after finishing (followed by "Workout saved."). */
  finished: 'End of the line!',
  /** After a workout that set a personal record. */
  record: "New record: the boiler's never run this hot!",
}

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
  'Shovel in more coal!',
  'Stoking the firebox. 🔥',
  'Building up a head of steam.',
  "Pressure's rising!",
  'Toot toot! 💨',
  'That set burned hot.',
] as const

/** The cheer after the n-th set of a workout (deterministic, so it doesn't flicker). */
export function cheer(setsDone: number): string {
  return CHEERS[(setsDone - 1 + CHEERS.length) % CHEERS.length]!
}

/** After a workout: the weight you moved, as coal for the engine. Null when there's none. */
export const firebox = (volumeKg: number): string | null =>
  volumeKg > 0 ? `${formatVolume(volumeKg)} shovelled into the firebox.` : null

// --- Rest timer -----------------------------------------------------------------------------

export const REST = {
  /** Above the countdown. */
  resting: 'Station stop',
  /** In place of the countdown when the rest is over. */
  done: 'All aboard! 🚂',
}

// --- History --------------------------------------------------------------------------------

export const HISTORY = {
  restDay: 'Rest day. The train was in the depot. 🚂',
}
