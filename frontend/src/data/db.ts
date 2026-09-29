/**
 * The on-device database (IndexedDB via Dexie). This is the only place data lives: nothing
 * is sent to a server. Back it up with Settings → Export.
 */
import { DEFAULT_REST_SECONDS } from '../lib/rest'
import { DEFAULT_WEEKLY_TARGET } from './line'
import Dexie, { type EntityTable } from 'dexie'
import type { ExerciseDetail, Settings, StoredRoutine, StoredWorkout } from './types'

export type RestPref = { exercise_id: string; rest_seconds: number } // 0 = no rest timer

/** Small singleton documents (the routine, settings), stored by key. */
type KeyValue = { key: 'routine'; value: StoredRoutine } | { key: 'settings'; value: Settings }

class GainsDb extends Dexie {
  workouts!: EntityTable<StoredWorkout, 'id'>
  customExercises!: EntityTable<ExerciseDetail, 'id'>
  restPrefs!: EntityTable<RestPref, 'exercise_id'>
  kv!: EntityTable<KeyValue, 'key'>

  constructor(name = 'gains-train') {
    super(name)
    // Only indexed fields are listed; every other field is stored too.
    // "*exercise_ids" is a multi-entry index: find workouts containing an exercise.
    this.version(1).stores({
      workouts: 'id, performed_on, status, routine_day_id, import_key, *exercise_ids',
      customExercises: 'id',
      restPrefs: 'exercise_id',
      kv: 'key',
    })
  }
}

export const db = new GainsDb()

export const DEFAULT_SETTINGS: Settings = {
  setup_completed_at: null,
  rest_timer_enabled: true,
  default_rest_seconds: DEFAULT_REST_SECONDS,
  weekly_target: DEFAULT_WEEKLY_TARGET,
  depot_weeks: [],
}

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return row?.key === 'settings' ? { ...DEFAULT_SETTINGS, ...row.value } : DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch }
  await db.kv.put({ key: 'settings', value: next })
  return next
}

export async function getStoredRoutine(): Promise<StoredRoutine | null> {
  const row = await db.kv.get('routine')
  return row?.key === 'routine' ? row.value : null
}
