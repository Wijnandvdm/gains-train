/**
 * Exercise preferences ("machine settings" in the code, the data and backups): how you set up
 * the machine for an exercise, the same every time (Seat 4, Pad L, Back −1). Per exercise, not
 * per workout or routine: change them anywhere (the set card, the routine editor, the
 * exercise's page) and they're the same everywhere. A setting can also be just a value ("13").
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type MachineSetting } from './db'

export const MAX_SETTINGS = 6
export const MAX_SETTING_NAME = 16
export const MAX_SETTING_VALUE = 12

const tidy = (s: string, max: number) => s.trim().replace(/\s+/g, ' ').slice(0, max)

/** Trimmed, without empty rows, at most MAX_SETTINGS. */
export function tidySettings(settings: MachineSetting[]): MachineSetting[] {
  return settings
    .map((s) => ({ name: tidy(s.name, MAX_SETTING_NAME), value: tidy(s.value, MAX_SETTING_VALUE) }))
    .filter((s) => s.name || s.value)
    .slice(0, MAX_SETTINGS)
}

export async function saveMachineSettings(
  exerciseId: string,
  settings: MachineSetting[],
): Promise<void> {
  const kept = tidySettings(settings)
  if (kept.length === 0) await db.machineSettings.delete(exerciseId)
  else await db.machineSettings.put({ exercise_id: exerciseId, settings: kept })
}

/** An exercise's settings, live; [] when it has none, undefined while loading. */
export function useMachineSettings(exerciseId: string): MachineSetting[] | undefined {
  return useLiveQuery(
    async () => (await db.machineSettings.get(exerciseId))?.settings ?? [],
    [exerciseId],
  )
}

/** "Seat 4", or just "13" for a setting without a name. */
export const settingLabel = (s: MachineSetting) => [s.name, s.value].filter(Boolean).join(' ')
