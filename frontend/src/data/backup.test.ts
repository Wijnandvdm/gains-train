import { describe, expect, it } from 'vitest'
import { libraryExercise } from '../test/library'
import { createBackup, restoreBackup, BackupError, backupFileName } from './backup'
import { db, getSettings, getStoredRoutine, updateSettings } from './db'
import { saveRoutine } from './routine'
import { addExercise, finishWorkout, saveSet, startWorkout } from './workouts'

async function someData() {
  const id = await startWorkout({
    name: 'Legs',
    performed_on: '2026-09-25',
    started_at: '2026-09-25T18:00:00Z',
    routine_day_id: null,
  })
  const we = await addExercise(id, 'Hack_Squat')
  await saveSet(id, {
    id: 's1',
    workout_exercise_id: we,
    position: 1,
    weight_kg: 60,
    reps: 8,
    rpe: null,
    is_warmup: false,
    notes: null,
    completed_at: '2026-09-25T18:05:00Z',
  })
  await finishWorkout(id)
  await db.customExercises.add({
    ...libraryExercise('custom-1', 'Bulgarian Split Squat'),
    is_custom: true,
  })
  await db.restPrefs.add({ exercise_id: 'Hack_Squat', rest_seconds: 195 })
  await saveRoutine({
    days: [{ name: 'Day1', exercises: [{ exercise_id: 'Hack_Squat', sets: 3 }] }],
  })
  await updateSettings({ setup_completed_at: '2026-09-01T00:00:00Z', default_rest_seconds: 120 })
}

describe('backups', () => {
  it('round-trips everything through a file', async () => {
    await someData()
    const file = JSON.stringify(await createBackup())
    await Promise.all(db.tables.map((t) => t.clear())) // a new phone

    const restored = await restoreBackup(JSON.parse(file))
    expect(restored.workouts).toHaveLength(1)
    expect((await db.workouts.toArray())[0]!.exercises[0]!.sets[0]!.weight_kg).toBe(60)
    expect(await db.customExercises.count()).toBe(1)
    expect((await db.restPrefs.get('Hack_Squat'))!.rest_seconds).toBe(195)
    expect((await getStoredRoutine())!.days[0]!.name).toBe('Day1')
    expect((await getSettings()).default_rest_seconds).toBe(120)
  })

  it('rejects wrong or damaged files without touching existing data', async () => {
    await someData()
    for (const bad of [
      null,
      { format: 'something-else' },
      { format: 'gains-train-backup', version: 99 },
      {
        format: 'gains-train-backup',
        version: 1,
        workouts: 'nope',
        custom_exercises: [],
        rest_prefs: [],
      },
      {
        format: 'gains-train-backup',
        version: 1,
        workouts: [{ id: 1 }],
        custom_exercises: [],
        rest_prefs: [],
        routine: null,
      },
    ]) {
      await expect(restoreBackup(bad)).rejects.toThrow(BackupError)
    }
    expect(await db.workouts.count()).toBe(1)
  })

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 8, 5))).toBe('gains-train-backup-2026-09-05.json')
  })
})
