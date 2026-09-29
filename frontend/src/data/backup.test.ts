import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { libraryExercise } from '../test/library'
import { saveFile } from '../lib/saveFile'
import {
  backupDue,
  BackupError,
  backupFileName,
  createBackup,
  exportBackup,
  readBackupFile,
  restoreBackup,
} from './backup'
import { db, DEFAULT_SETTINGS, getSettings, getStoredRoutine, updateSettings } from './db'
import { setLibraryForTests } from './library'
import { saveRoutine } from './routine'
import { addExercise, finishWorkout, saveSet, startWorkout } from './workouts'

// Capture the file instead of opening a share sheet.
vi.mock('../lib/saveFile', () => ({ saveFile: vi.fn(async () => true) }))
const saved = () => vi.mocked(saveFile).mock.calls.at(-1)!

beforeEach(() => {
  vi.mocked(saveFile).mockClear()
  setLibraryForTests([libraryExercise('Hack_Squat', 'Hack Squat')])
})

async function someData() {
  const id = await startWorkout({
    name: 'Day1 · Legs, "heavy"',
    performed_on: '2026-09-25',
    started_at: '2026-09-25T18:00:00Z',
    routine_day_id: null,
  })
  const we = await addExercise(id, 'Hack_Squat')
  await saveSet(id, {
    id: 's1',
    workout_exercise_id: we,
    position: 1,
    weight_kg: 62.5,
    reps: 8,
    is_warmup: false,
    notes: 'felt easy,\nnext time 65',
    completed_at: '2026-09-25T18:05:00Z',
  })
  await saveSet(id, {
    id: 's2',
    workout_exercise_id: we,
    position: 2,
    weight_kg: 40,
    reps: 10,
    is_warmup: true,
    notes: null,
    completed_at: null,
  })
  await addExercise(id, 'custom-1') // no sets yet
  await finishWorkout(id, '2026-09-25T19:00:00Z')
  await db.customExercises.add({
    ...libraryExercise('custom-1', 'Bulgarian Split Squat', {
      primary_muscles: ['glutes', 'quadriceps'],
      instructions: ['Stand in front of a bench.', 'Lower the back knee.'],
    }),
    is_custom: true,
    image_urls: [],
  })
  await db.restPrefs.add({ exercise_id: 'Hack_Squat', rest_seconds: 195 })
  await saveRoutine({
    days: [
      { name: 'Day1', exercises: [{ exercise_id: 'Hack_Squat', sets: 3 }] },
      { name: 'Rest day, stretch', exercises: [] },
    ],
  })
  await updateSettings({
    setup_completed_at: '2026-09-01T00:00:00Z',
    default_rest_seconds: 120,
    depot_weeks: ['2026-08-03', '2026-08-10'],
  })
}

const everything = async () => ({
  workouts: await db.workouts.toArray(),
  customs: await db.customExercises.toArray(),
  rest: await db.restPrefs.toArray(),
  routine: await getStoredRoutine(),
  settings: { ...(await getSettings()), last_backup_at: null, backup_reminded_at: null },
})

describe('backups', () => {
  it('round-trips everything through the zip, exactly', async () => {
    await someData()
    const before = await everything()
    await exportBackup(new Date('2026-09-29T08:00:00Z'))
    const [name, bytes] = saved()
    expect(name).toBe('gains-train-backup-2026-09-29.zip')
    await Promise.all(db.tables.map((t) => t.clear())) // a new phone

    await restoreBackup(await readBackupFile(new Blob([bytes as BlobPart])))
    expect(await everything()).toEqual(before)
    expect((await getSettings()).last_backup_at).toBe('2026-09-29T08:00:00.000Z')
  })

  it('holds spreadsheet-friendly CSV tables', async () => {
    await someData()
    await exportBackup()
    const files = unzipSync(saved()[1] as Uint8Array)
    expect(Object.keys(files).sort()).toEqual([
      'custom-exercises.csv',
      'rest-times.csv',
      'routine.csv',
      'settings.csv',
      'workouts.csv',
    ])
    // Starts with the byte-order mark Excel needs to read UTF-8.
    expect([...files['workouts.csv']!.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const workouts = strFromU8(files['workouts.csv']!)
      .replace(/^\uFEFF/, '')
      .split('\r\n')
    expect(workouts[0]).toMatch(/^date,workout,exercise,set,weight_kg,reps,warm_up,/)
    expect(workouts[1]).toMatch(/^2026-09-25,"Day1 · Legs, ""heavy""",Hack Squat,1,62.5,8,no,/)
  })

  it('still imports the older .json backups', async () => {
    await someData()
    const old = { ...(await createBackup()), version: 1 }
    await Promise.all(db.tables.map((t) => t.clear()))
    const backup = await readBackupFile(new Blob([JSON.stringify(old)]))
    await restoreBackup(backup)
    expect(await db.workouts.count()).toBe(1)
    expect((await getStoredRoutine())!.days).toHaveLength(2)
  })

  it('rejects wrong or damaged files, and nothing is changed', async () => {
    await someData()
    await exportBackup()
    const good = unzipSync(saved()[1] as Uint8Array)
    const zip = (changes: Record<string, string | null>) => {
      const files = { ...good }
      for (const [name, text] of Object.entries(changes)) {
        if (text === null) delete files[name]
        else files[name] = strToU8(text)
      }
      return new Blob([zipSync(files)])
    }
    const bad: [Blob, RegExp][] = [
      [new Blob(['date,day,exercise\n']), /isn't a gains-train backup/],
      [new Blob([JSON.stringify({ format: 'something-else' })]), /isn't a gains-train backup/],
      [
        zip({ 'settings.csv': 'setting,value\nformat,gains-train-backup\nversion,99\n' }),
        /newer version/,
      ],
      [zip({ 'routine.csv': null }), /routine\.csv is missing/],
      [
        zip({ 'rest-times.csv': 'exercise\nHack Squat\n' }),
        /rest-times\.csv: missing columns: exercise_id, rest_seconds/,
      ],
      [
        zip({
          'workouts.csv':
            'date,workout_id,workout_exercise_id,exercise_id,set_id,weight_kg\n2026-09-25,w,we,Hack_Squat,s,heavy\n',
        }),
        /weight_kg: "heavy"/,
      ],
    ]
    for (const [file, message] of bad) {
      await expect(readBackupFile(file)).rejects.toThrow(BackupError)
      await expect(readBackupFile(file)).rejects.toThrow(message)
    }
    expect(await db.workouts.count()).toBe(1)
  })

  it('remembers the last backup only when you saved it', async () => {
    vi.mocked(saveFile).mockResolvedValueOnce(false) // you closed the share sheet
    expect(await exportBackup()).toBeNull()
    expect((await getSettings()).last_backup_at).toBeNull()
    await exportBackup(new Date('2026-09-29T08:00:00Z'))
    expect((await getSettings()).last_backup_at).toBe('2026-09-29T08:00:00.000Z')
  })

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 8, 5))).toBe('gains-train-backup-2026-09-05.zip')
  })
})

describe('the backup reminder', () => {
  const at = (iso: string) => new Date(iso)
  const settings = (patch = {}) => ({ ...DEFAULT_SETTINGS, ...patch })

  it('asks half a year after your last backup (or your first workout)', () => {
    const s = settings({ last_backup_at: '2026-03-01T10:00:00Z' })
    expect(backupDue(s, '2025-01-01', at('2026-08-31T12:00:00Z'))).toBe(false)
    expect(backupDue(s, '2025-01-01', at('2026-09-02T12:00:00Z'))).toBe(true)
    expect(backupDue(settings(), '2026-04-01', at('2026-09-29T12:00:00Z'))).toBe(false)
    expect(backupDue(settings(), '2026-03-01', at('2026-09-29T12:00:00Z'))).toBe(true)
  })

  it('waits a week after "not now", and never asks when off or without workouts', () => {
    const now = at('2026-09-29T12:00:00Z')
    const old = { last_backup_at: '2025-01-01T00:00:00Z' }
    expect(
      backupDue(
        settings({ ...old, backup_reminded_at: '2026-09-25T12:00:00Z' }),
        '2025-01-01',
        now,
      ),
    ).toBe(false)
    expect(
      backupDue(
        settings({ ...old, backup_reminded_at: '2026-09-20T12:00:00Z' }),
        '2025-01-01',
        now,
      ),
    ).toBe(true)
    expect(backupDue(settings({ ...old, backup_reminder_months: 0 }), '2025-01-01', now)).toBe(
      false,
    )
    expect(backupDue(settings(old), null, now)).toBe(false)
  })
})
