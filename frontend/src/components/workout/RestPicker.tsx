import type { ExerciseSummary } from '../../api/schema'
import { useMe } from '../../auth'
import { formatClock } from '../../lib/format'
import { DEFAULT_REST_SECONDS, REST_CHOICES, smartRestSeconds } from '../../lib/rest'
import { useExercisePreferences, useSetRest } from '../../preferences'

const AUTO = 'auto'
const OFF = '0'

/** Rest time after each set of this exercise: automatic, a fixed time, or no timer. */
export function RestPicker({ exercise }: { exercise: ExerciseSummary }) {
  const { data: me } = useMe()
  const { data: preferences } = useExercisePreferences()
  const setRest = useSetRest()

  const smart = smartRestSeconds(exercise, me?.default_rest_seconds ?? DEFAULT_REST_SECONDS)
  const own = preferences?.get(exercise.id)
  // A time set with ±15s may not be one of the standard choices: offer it too.
  const choices =
    own && !REST_CHOICES.includes(own) ? [...REST_CHOICES, own].sort((a, b) => a - b) : REST_CHOICES

  return (
    <label className="flex items-center gap-1 text-sm text-neutral-500">
      <span aria-hidden="true">⏱</span>
      <select
        aria-label={`Rest after each set of ${exercise.name}`}
        value={own === undefined ? AUTO : String(own)}
        onChange={(e) =>
          setRest.mutate({
            exerciseId: exercise.id,
            seconds: e.target.value === AUTO ? null : Number(e.target.value),
          })
        }
        className="rounded-md bg-transparent py-1 text-base text-neutral-700 outline-none focus:ring-2 focus:ring-brand-500 dark:text-neutral-300"
      >
        <option value={AUTO}>Auto ({formatClock(smart)})</option>
        {choices.map((seconds) => (
          <option key={seconds} value={seconds}>
            {formatClock(seconds)}
          </option>
        ))}
        <option value={OFF}>No timer</option>
      </select>
      {me && !me.rest_timer_enabled && <span className="text-xs">(timer off)</span>}
    </label>
  )
}
