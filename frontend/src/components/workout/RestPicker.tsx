import type { ExerciseSummary } from '../../data/types'
import { formatClock } from '../../lib/format'
import { DEFAULT_REST_SECONDS, REST_CHOICES, smartRestSeconds } from '../../lib/rest'
import { setRest, useExercisePreferences } from '../../preferences'
import { useSettings } from '../../settings'

const AUTO = 'auto'
const OFF = '0'

/** Rest time after each set of this exercise: automatic, a fixed time, or no timer. */
export function RestPicker({ exercise }: { exercise: ExerciseSummary }) {
  const settings = useSettings()
  const { data: preferences } = useExercisePreferences()

  const smart = smartRestSeconds(exercise, settings?.default_rest_seconds ?? DEFAULT_REST_SECONDS)
  const own = preferences?.get(exercise.id)
  if (!settings?.rest_timer_enabled) return null // loading, or opted out of rest timers

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
          void setRest(exercise.id, e.target.value === AUTO ? null : Number(e.target.value))
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
    </label>
  )
}
