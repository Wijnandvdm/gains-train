/**
 * The app's data shapes. Field names match what the screens have always used
 * (performed_on, weight_kg, …) so the move from server to device didn't ripple through them.
 *
 * Stored* types are what IndexedDB keeps; the others are "hydrated" for the screens
 * (e.g. a stored workout references exercises by id, the screens get the full exercise).
 */

// --- Exercises ----------------------------------------------------------------------------

/** Library exercises use the dataset's id ("Hack_Squat"); custom ones "custom-<uuid>". */
export type ExerciseId = string

export type ExerciseSummary = {
  id: ExerciseId
  name: string
  equipment: string | null
  category: string | null
  level: string | null
  mechanic: string | null
  force: string | null
  is_custom: boolean
  primary_muscles: string[]
  secondary_muscles: string[]
  image_urls: string[]
}

export type ExerciseDetail = ExerciseSummary & { instructions: string[] }

export type ExerciseFilters = { muscles: string[]; equipment: string[]; categories: string[] }

// --- Workouts -----------------------------------------------------------------------------

export type WorkoutStatus = 'in_progress' | 'completed'

export type SetOut = {
  id: string
  workout_exercise_id: string
  position: number
  weight_kg: number | null
  reps: number | null
  rpe: number | null
  is_warmup: boolean
  notes: string | null
  completed_at: string | null
}

export type StoredWorkoutExercise = {
  id: string
  exercise_id: ExerciseId
  position: number
  notes: string | null
  sets: SetOut[]
}

export type StoredWorkout = {
  id: string
  name: string | null
  routine_day_id: string | null
  performed_on: string // YYYY-MM-DD (local)
  status: WorkoutStatus
  started_at: string | null
  ended_at: string | null
  notes: string | null
  /** Set for imported workouts (legacy sheet): makes re-importing update, not duplicate. */
  import_key: string | null
  exercises: StoredWorkoutExercise[]
  /** Derived from `exercises`, for the "last time" lookup index. */
  exercise_ids: ExerciseId[]
}

export type WorkoutExerciseOut = Omit<StoredWorkoutExercise, 'exercise_id'> & {
  exercise: ExerciseSummary
}

export type WorkoutDetail = Omit<StoredWorkout, 'exercises' | 'exercise_ids' | 'import_key'> & {
  exercises: WorkoutExerciseOut[]
}

export type WorkoutSummary = Omit<WorkoutDetail, 'exercises' | 'notes'> & {
  exercise_names: string[]
  set_count: number
  volume_kg: number
}

/** One past workout's sets for one exercise (for "last time" hints). */
export type ExerciseSession = {
  workout_id: string
  workout_name: string | null
  performed_on: string
  sets: SetOut[]
}

// --- Routine ------------------------------------------------------------------------------

export type StoredRoutine = {
  days: { id: string; name: string; exercises: { exercise_id: ExerciseId; sets: number }[] }[]
}

export type RoutineDayOut = {
  id: string
  position: number
  name: string
  exercises: { exercise: ExerciseSummary; sets: number }[]
}

export type RoutineOut = { days: RoutineDayOut[]; next_day_id: string | null }

// --- Settings -----------------------------------------------------------------------------

export type Settings = {
  setup_completed_at: string | null
  rest_timer_enabled: boolean
  default_rest_seconds: number
}

// --- Stats --------------------------------------------------------------------------------

export type SetRecordOut = { weight_kg: number; reps: number; performed_on: string }

export type RecordsOut = {
  heaviest: SetRecordOut
  best_e1rm: SetRecordOut
  best_e1rm_kg: number
  best_session_volume_kg: number
  best_session_volume_on: string
  rep_records: SetRecordOut[]
}

export type SessionPoint = {
  workout_id: string
  performed_on: string
  top_weight_kg: number
  top_weight_reps: number
  best_e1rm_kg: number
  volume_kg: number
  set_count: number
}

export type ExerciseStats = { records: RecordsOut | null; sessions: SessionPoint[] }

export type ExerciseOverviewOut = {
  exercise: ExerciseSummary
  sets_logged: number
  last_performed_on: string
  last_top_weight_kg: number
  max_weight_kg: number
  best_e1rm_kg: number
  total_volume_kg: number
}
