/**
 * After an update adds exercises to the library: which of your own exercises is probably one of
 * them? Names that share most of their words ("Hip thrust machine" and "Machine Hip Thrust"),
 * a little more when the main muscle matches too. Only a suggestion: the app asks you first
 * (see data/migrate.ts for when, and the card on the Workout screen).
 */
import type { ExerciseSummary } from './types'

/** Your exercise, and the new library exercise it's probably the same as. */
export type MatchSuggestion = { custom_id: string; library_id: string }

/** How close two names must be (0–1) to ask. */
const ASK_FROM = 0.5

/** The words of a name, lower case and singular-ish ("Curls" → "curl"). */
function words(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)),
  )
}

/** 0–1: the share of words the names have in common, plus a bit for the same main muscle. */
export function matchScore(mine: ExerciseSummary, theirs: ExerciseSummary): number {
  const a = words(mine.name)
  const b = words(theirs.name)
  const shared = [...a].filter((w) => b.has(w)).length
  const all = new Set([...a, ...b]).size
  const sameMuscle = mine.primary_muscles.some((m) => theirs.primary_muscles.includes(m))
  return Math.min(1, (all ? shared / all : 0) + (sameMuscle ? 0.15 : 0))
}

/** For each of your exercises, the closest new library exercise, if it's close enough. */
export function suggestMatches(
  customs: ExerciseSummary[],
  added: ExerciseSummary[],
): MatchSuggestion[] {
  return customs.flatMap((custom) => {
    const best = added
      .map((e) => ({ e, score: matchScore(custom, e) }))
      .sort((x, y) => y.score - x.score)[0]
    return best && best.score >= ASK_FROM ? [{ custom_id: custom.id, library_id: best.e.id }] : []
  })
}
