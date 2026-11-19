// After an update added exercises: "Is that your …?" for one of your own exercises at a time.
// Yes moves everything of yours (workouts, records, routine, preferences) to the library one;
// no keeps yours, and that one isn't asked again. The rules live in data/migrate.ts.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { answerSuggestion, librarySuggestions } from '../data/migrate'
import { useExerciseLookup } from '../exercises'
import { plural } from '../lib/format'
import { useAction } from '../lib/useAction'
import { ErrorMessage } from './ErrorMessage'

export function LibraryMatchCard() {
  const lookup = useExerciseLookup()
  // The first suggestion whose exercise of yours is still there, with how often you logged it
  // (looked up together, so the card never shows a half-finished count).
  const found = useLiveQuery(async () => {
    for (const s of await librarySuggestions()) {
      if (!(await db.customExercises.get(s.custom_id))) continue
      return {
        suggestion: s,
        workouts: await db.workouts.where('exercise_ids').equals(s.custom_id).count(),
      }
    }
    return null
  }, [])
  const answer = useAction(answerSuggestion)
  if (!found || !lookup) return null
  const { suggestion, workouts } = found
  const theirs = lookup(suggestion.library_id)
  const mine = lookup(suggestion.custom_id)
  if (theirs.is_custom) return null // not (or no longer) in the library

  return (
    <section aria-label="New in the library" className="card flex flex-col gap-2 p-3">
      <p className="text-xs font-semibold tracking-wide text-train-700 uppercase dark:text-train-500">
        New in the library
      </p>
      <p>
        <span className="font-semibold">{theirs.name}</span>: is that your “{mine.name}”?
      </p>
      <p className="text-sm text-neutral-500">
        {workouts > 0
          ? `Your ${plural(workouts, 'workout')} and records with it move over, and it gets a drawing.`
          : 'It gets a drawing, and your routine and preferences move over.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={answer.isPending}
          onClick={() => void answer.run(suggestion, true).catch(() => {})}
        >
          Yes, use it
        </button>
        <button
          type="button"
          className="btn"
          disabled={answer.isPending}
          onClick={() => void answer.run(suggestion, false).catch(() => {})}
        >
          No, keep mine
        </button>
      </div>
      <ErrorMessage error={answer.error} prefix="Couldn't change it:" />
    </section>
  )
}
