/**
 * Backups: everything on the device as one JSON file, and restoring from it.
 * The data only lives on your phone, so this file is your safety net (and how you move
 * to a new phone).
 */
import { db, DEFAULT_SETTINGS, getSettings, getStoredRoutine, type RestPref } from './db'
import type { ExerciseDetail, Settings, StoredRoutine, StoredWorkout } from './types'

export const BACKUP_FORMAT = 'gains-train-backup'
export const BACKUP_VERSION = 1

export type Backup = {
  format: typeof BACKUP_FORMAT
  version: number
  exported_at: string
  workouts: StoredWorkout[]
  custom_exercises: ExerciseDetail[]
  rest_prefs: RestPref[]
  routine: StoredRoutine | null
  settings: Settings
}

export class BackupError extends Error {}

export async function createBackup(now = new Date()): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    workouts: await db.workouts.toArray(),
    custom_exercises: await db.customExercises.toArray(),
    rest_prefs: await db.restPrefs.toArray(),
    routine: await getStoredRoutine(),
    settings: await getSettings(),
  }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gains-train-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Check a parsed file before it replaces anything (throws BackupError with a reason). */
export function validateBackup(data: unknown): Backup {
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupError("This isn't a gains-train backup file.")
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update first.')
  }
  for (const key of ['workouts', 'custom_exercises', 'rest_prefs'] as const) {
    if (!Array.isArray(data[key])) throw new BackupError(`The backup is damaged (${key}).`)
  }
  for (const w of data.workouts as unknown[]) {
    if (
      !isObject(w) ||
      typeof w.id !== 'string' ||
      typeof w.performed_on !== 'string' ||
      !Array.isArray(w.exercises) ||
      !Array.isArray(w.exercise_ids)
    ) {
      throw new BackupError('The backup is damaged (a workout is incomplete).')
    }
  }
  if (data.routine !== null && !(isObject(data.routine) && Array.isArray(data.routine.days))) {
    throw new BackupError('The backup is damaged (routine).')
  }
  return {
    ...(data as unknown as Backup),
    settings: { ...DEFAULT_SETTINGS, ...(isObject(data.settings) ? data.settings : {}) },
  }
}

/** Read and check a picked backup file; nothing is changed yet. */
export async function readBackupFile(file: Blob): Promise<Backup> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new BackupError("This isn't a gains-train backup file.")
  }
  return validateBackup(data)
}

/** Replace everything on the device with the backup's contents (all or nothing). */
export async function restoreBackup(data: unknown): Promise<Backup> {
  const backup = validateBackup(data)
  await db.transaction('rw', db.workouts, db.customExercises, db.restPrefs, db.kv, async () => {
    await Promise.all([
      db.workouts.clear(),
      db.customExercises.clear(),
      db.restPrefs.clear(),
      db.kv.clear(),
    ])
    await db.workouts.bulkAdd(backup.workouts)
    await db.customExercises.bulkAdd(backup.custom_exercises)
    await db.restPrefs.bulkAdd(backup.rest_prefs)
    if (backup.routine) await db.kv.put({ key: 'routine', value: backup.routine })
    await db.kv.put({ key: 'settings', value: backup.settings })
  })
  return backup
}
