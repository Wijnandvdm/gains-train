/**
 * Workout data for the screens, live from the device: when anything changes, every screen
 * showing it updates by itself (Dexie's live queries).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../data/db'
import type {
  ExerciseSession,
  ExerciseSummary,
  RoutineDay,
  WorkoutSet,
  WorkoutDetail,
  WorkoutSummary,
} from '../data/types'
import {
  activeWorkout,
  addExercise,
  deleteSet,
  deleteWorkout,
  exerciseSessions,
  finishWorkout,
  getWorkout,
  hydrate,
  removeExercise,
  saveSet,
  startWorkout,
  summarize,
  workoutsBetween,
  newSet,
} from '../data/workouts'
import { useExerciseLookup } from '../exercises'
import { localDateString } from '../lib/format'

/** The workout in progress (null if none); undefined while loading. */
export function useActiveWorkout(): { data: WorkoutDetail | null | undefined; isPending: boolean } {
  const lookup = useExerciseLookup()
  const stored = useLiveQuery(async () => (await activeWorkout()) ?? null, [])
  const data = stored === undefined || !lookup ? undefined : stored && hydrate(stored, lookup)
  return { data, isPending: data === undefined }
}

/** Your previous session of an exercise, for "last time" hints. */
export function useLastTime(exerciseId: string): { data: ExerciseSession | null | undefined } {
  const data = useLiveQuery(
    async () => (await exerciseSessions(exerciseId, 1))[0] ?? null,
    [exerciseId],
  )
  return { data }
}

/** Last time's sets for several exercises at once (exercise id → sets). */
export function useLastTimes(exerciseIds: string[]): Map<string, WorkoutSet[]> {
  const key = exerciseIds.join('|')
  const sessions = useLiveQuery(
    () =>
      Promise.all(
        key
          .split('|')
          .filter(Boolean)
          .map((id) => exerciseSessions(id, 1)),
      ),
    [key],
  )
  return useMemo(
    () => new Map(exerciseIds.map((id, i) => [id, sessions?.[i]?.[0]?.sets ?? []])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for exerciseIds
    [key, sessions],
  )
}

/** Workout summaries between two dates (inclusive, open when omitted), newest first. */
export function useWorkoutSummaries(
  from?: string,
  to?: string,
): { data: WorkoutSummary[] | undefined; isPending: boolean } {
  const lookup = useExerciseLookup()
  const stored = useLiveQuery(() => workoutsBetween(from, to), [from, to])
  const data = useMemo(
    () => (stored && lookup ? stored.map((w) => summarize(w, lookup)) : undefined),
    [stored, lookup],
  )
  return { data, isPending: data === undefined }
}

/** One workout; data is null when it doesn't exist. */
export function useWorkout(id: string): {
  data: WorkoutDetail | null | undefined
  isPending: boolean
} {
  const lookup = useExerciseLookup()
  const stored = useLiveQuery(async () => (await getWorkout(id)) ?? null, [id])
  const data = stored === undefined || !lookup ? undefined : stored && hydrate(stored, lookup)
  return { data, isPending: data === undefined }
}

export { deleteWorkout }

/** Changing the active workout. Writes go straight to the device; screens follow live. */
export function useWorkoutActions() {
  return useMemo(
    () => ({
      /** Start a routine day in one tap: the day's exercises, with the first set logged. */
      async startDay(day: RoutineDay, firstSet: { weight_kg: number; reps: number }) {
        await db.transaction('rw', db.workouts, async () => {
          const workoutId = await startWorkout({
            name: day.name,
            performed_on: localDateString(),
            started_at: new Date().toISOString(),
            routine_day_id: day.id,
          })
          for (const [i, { exercise }] of day.exercises.entries()) {
            const workoutExerciseId = await addExercise(workoutId, exercise.id)
            if (i === 0) {
              await saveSet(
                workoutId,
                newSet(workoutExerciseId, 1, {
                  ...firstSet,
                  completed_at: new Date().toISOString(),
                }),
              )
            }
          }
        })
      },
      /** Start a workout; optionally with the same exercises as a previous one. */
      async start({ name, copyFrom }: { name?: string | null; copyFrom?: string } = {}) {
        const previous = copyFrom ? await getWorkout(copyFrom) : undefined
        await db.transaction('rw', db.workouts, async () => {
          const workoutId = await startWorkout({
            name: name ?? null,
            performed_on: localDateString(),
            started_at: new Date().toISOString(),
            routine_day_id: null,
          })
          for (const we of previous?.exercises ?? []) await addExercise(workoutId, we.exercise_id)
        })
      },
      addExercise: (workoutId: string, exercise: ExerciseSummary) =>
        addExercise(workoutId, exercise.id),
      removeExercise,
      saveSet,
      deleteSet: (workoutId: string, set: WorkoutSet) => deleteSet(workoutId, set.id),
      finish: (workoutId: string) => finishWorkout(workoutId),
      discard: (workoutId: string) => deleteWorkout(workoutId),
    }),
    [],
  )
}
