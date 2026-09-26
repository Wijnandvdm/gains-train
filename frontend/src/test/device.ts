// Puts data on the (fake, in-memory) device before a UI test, like a phone already in use.
import { db, getSettings, getStoredRoutine, updateSettings } from '../data/db'
import { setLibraryForTests } from '../data/library'
import type {
  ExerciseDetail,
  SetOut,
  Settings,
  StoredRoutine,
  StoredWorkout,
  StoredWorkoutExercise,
} from '../data/types'
import { libraryExercise } from './library'

export const ROW = libraryExercise('Seated_Cable_Rows', 'Seated Cable Rows', {
  primary_muscles: ['middle back'],
})
export const PULLDOWN = libraryExercise('Wide-Grip_Lat_Pulldown', 'Wide-Grip Lat Pulldown', {
  primary_muscles: ['lats'],
})

export function set(
  id: string,
  weId: string,
  position: number,
  weight: number | null,
  reps: number | null,
  overrides: Partial<SetOut> = {},
): SetOut {
  return {
    id,
    workout_exercise_id: weId,
    position,
    weight_kg: weight,
    reps,
    rpe: null,
    is_warmup: false,
    notes: null,
    completed_at: '2026-09-15T18:00:00Z',
    ...overrides,
  }
}

/** A finished workout; `exercises` is [exercise id, sets][] in order. */
export function workout(
  overrides: Partial<StoredWorkout> & { id: string },
  exercises: [string, SetOut[]][] = [],
): StoredWorkout {
  const stored: StoredWorkoutExercise[] = exercises.map(([exerciseId, sets], i) => ({
    id: sets[0]?.workout_exercise_id ?? `${overrides.id}-we${i + 1}`,
    exercise_id: exerciseId,
    position: i + 1,
    notes: null,
    sets,
  }))
  return {
    name: null,
    routine_day_id: null,
    performed_on: '2026-09-15',
    status: 'completed',
    started_at: null,
    ended_at: null,
    notes: null,
    import_key: null,
    ...overrides,
    exercises: stored,
    exercise_ids: [...new Set(stored.map((e) => e.exercise_id))],
  }
}

/** Your last Day2 session: Seated Cable Rows 80×12, 80×10. */
export const LAST_DAY2 = workout({ id: 'last-day2', name: 'Day2 · Back & Triceps' }, [
  [ROW.id, [set('old-1', 'we-old', 1, 80, 12), set('old-2', 'we-old', 2, 80, 10)]],
])

/** A one-day routine: Seated Cable Rows (3 sets) then Wide-Grip Lat Pulldown (1 set). */
export const DAY2_ROUTINE: StoredRoutine = {
  days: [
    {
      id: 'day2',
      name: 'Day2 · Back & Triceps',
      exercises: [
        { exercise_id: ROW.id, sets: 3 },
        { exercise_id: PULLDOWN.id, sets: 1 },
      ],
    },
  ],
}

export async function seedDevice({
  library = [ROW, PULLDOWN],
  setupDone = true,
  settings = {},
  routine = null,
  workouts = [],
  customExercises = [],
  restPrefs = {},
}: {
  library?: ExerciseDetail[]
  setupDone?: boolean
  settings?: Partial<Settings>
  routine?: StoredRoutine | null
  workouts?: StoredWorkout[]
  customExercises?: ExerciseDetail[]
  /** exercise id → rest seconds */
  restPrefs?: Record<string, number>
} = {}) {
  setLibraryForTests(library)
  await updateSettings({
    setup_completed_at: setupDone ? '2026-09-01T00:00:00Z' : null,
    ...settings,
  })
  if (routine) await db.kv.put({ key: 'routine', value: routine })
  await db.workouts.bulkPut(workouts)
  await db.customExercises.bulkPut(customExercises)
  await db.restPrefs.bulkPut(
    Object.entries(restPrefs).map(([exercise_id, rest_seconds]) => ({ exercise_id, rest_seconds })),
  )
}

/** The sets logged in the app (not the seeded LAST_DAY2), as "exercise id: weight×reps ✓". */
export async function loggedSets(status: 'in_progress' | 'completed'): Promise<string[]> {
  const workouts = await db.workouts.where('status').equals(status).toArray()
  return workouts
    .filter((w) => w.id !== LAST_DAY2.id)
    .flatMap((w) =>
      w.exercises.flatMap((we) =>
        we.sets.map(
          (s) => `${we.exercise_id}: ${s.weight_kg}×${s.reps}${s.completed_at ? ' ✓' : ''}`,
        ),
      ),
    )
}

export { getSettings, getStoredRoutine }
