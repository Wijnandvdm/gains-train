import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo } from 'react'
import { db } from './data/db'
import type { ExerciseSummary } from './data/types'
import { DEFAULT_REST_SECONDS, restSecondsFor } from './lib/rest'
import { useSettings } from './settings'
import { useRestTimer } from './workout/restTimer'

type RestMap = ReadonlyMap<string, number>

/** Your per-exercise rest times (exercise id → seconds; 0 = no timer). */
export function useExercisePreferences(): { data: RestMap | undefined } {
  const rows = useLiveQuery(() => db.restPrefs.toArray(), [])
  return {
    data: useMemo(() => rows && new Map(rows.map((r) => [r.exercise_id, r.rest_seconds])), [rows]),
  }
}

/** Set an exercise's rest time (seconds, 0 = no timer), or null to go back to automatic. */
export async function setRest(exerciseId: string, seconds: number | null): Promise<void> {
  if (seconds === null) await db.restPrefs.delete(exerciseId)
  else await db.restPrefs.put({ exercise_id: exerciseId, rest_seconds: seconds })
}

/**
 * How long to rest after a set of this exercise; 0 when there should be no timer
 * (switched off in Settings, or for this exercise).
 */
function useRestFor(): (exercise: ExerciseSummary) => number {
  const settings = useSettings()
  const { data: preferences } = useExercisePreferences()
  return useCallback(
    (exercise: ExerciseSummary) =>
      settings && !settings.rest_timer_enabled
        ? 0
        : restSecondsFor(
            exercise,
            preferences ?? new Map(),
            settings?.default_rest_seconds ?? DEFAULT_REST_SECONDS,
          ),
    [settings, preferences],
  )
}

/**
 * The rest timer, wired to your preferences: `startFor(exercise)` runs it for that
 * exercise's rest time (or not at all), and ±15s on the timer is remembered for it.
 */
export function useExerciseRestTimer() {
  const restFor = useRestFor()
  const timer = useRestTimer({
    onAdjust: (exerciseId, seconds) => void setRest(exerciseId, seconds),
  })
  const { start } = timer
  const startFor = useCallback(
    (exercise: ExerciseSummary) => {
      const seconds = restFor(exercise)
      if (seconds > 0) start(seconds, exercise.id)
    },
    [restFor, start],
  )
  return { ...timer, startFor }
}
