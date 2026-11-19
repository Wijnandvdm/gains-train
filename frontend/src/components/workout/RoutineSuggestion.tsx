// After you change a routine workout (reorder, add or remove an exercise): "…from now on?",
// to make it your routine day's standard. Goes away by itself after a few seconds, or when
// you log a set (see WorkoutPage); ignoring it changes nothing.
import { useEffect, useEffectEvent, useState } from 'react'
import { changeRoutineDay, type DayChange } from '../../data/routine'
import { useAction } from '../../lib/useAction'

export type Suggestion = { dayId: string; question: string; change: DayChange }

/** How long the question waits for you. */
const SHOW_FOR_MS = 8000

export function RoutineSuggestion({
  suggestion,
  onDone,
}: {
  suggestion: Suggestion
  onDone: () => void
}) {
  const [saved, setSaved] = useState(false)
  const save = useAction(changeRoutineDay)

  // Counts from when the question (or "Routine updated.") shows, however often the screen
  // redraws (the rest timer does, every second).
  const done = useEffectEvent(onDone)
  useEffect(() => {
    const timer = setTimeout(done, saved ? 2000 : SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [suggestion, saved])

  if (saved) {
    return (
      <p role="status" className="text-center text-sm text-done-700 dark:text-done-500">
        Routine updated.
      </p>
    )
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-neutral-600 dark:text-neutral-300"
    >
      <span>{suggestion.question}</span>
      <span className="flex gap-3">
        <button
          type="button"
          className="font-semibold text-train-700 underline dark:text-train-500"
          disabled={save.isPending}
          onClick={() =>
            save.run(suggestion.dayId, suggestion.change).then(
              () => setSaved(true),
              () => {},
            )
          }
        >
          Yes
        </button>
        <button type="button" className="text-neutral-500 underline" onClick={onDone}>
          Not now
        </button>
      </span>
      {save.error && (
        <span className="w-full text-error-600 dark:text-error-400">{save.error.message}</span>
      )}
    </div>
  )
}
