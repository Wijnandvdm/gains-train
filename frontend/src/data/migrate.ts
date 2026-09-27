/**
 * Keeps your data in step with the exercise library when the library changes (a new app
 * version, or restoring an old backup):
 *
 * 1. An exercise you logged that is no longer in the library becomes a custom exercise with
 *    the same id, so your history, records and routine keep it.
 * 2. A custom exercise with the same name as a library exercise is merged into the library
 *    one (it gains the drawing and instructions); your data moves over to it.
 *
 * Safe to run any time: when everything is in step, it changes nothing.
 */
import { db, getStoredRoutine } from './db'
import { loadLibrary, loadRetired } from './library'
import type { ExerciseDetail, StoredWorkout } from './types'

export async function syncWithLibrary(): Promise<{ kept: number; merged: number }> {
  const library = await loadLibrary()

  // 1. Logged exercises that left the library → custom exercises (same id).
  const customs = new Map((await db.customExercises.toArray()).map((c) => [c.id, c]))
  const missing = [...(await usedExerciseIds())].filter(
    (id) => !library.has(id) && !customs.has(id),
  )
  let kept: ExerciseDetail[] = []
  if (missing.length > 0) {
    const retired = await loadRetired()
    kept = missing.flatMap((id) => {
      const exercise = retired.get(id)
      return exercise ? [{ ...exercise, is_custom: true, image_urls: [] }] : []
    })
    await db.customExercises.bulkPut(kept)
  }

  // 2. Custom exercises that the library now has too (same name) → the library's.
  const byName = new Map([...library.values()].map((e) => [e.name.toLowerCase(), e.id]))
  const merges = new Map<string, string>()
  for (const custom of await db.customExercises.toArray()) {
    const id = byName.get(custom.name.toLowerCase())
    if (id && id !== custom.id) merges.set(custom.id, id)
  }
  if (merges.size > 0) await renameExercises(merges)

  return { kept: kept.length, merged: merges.size }
}

async function usedExerciseIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const w of await db.workouts.toArray()) w.exercise_ids.forEach((id) => ids.add(id))
  for (const day of (await getStoredRoutine())?.days ?? []) {
    day.exercises.forEach((e) => ids.add(e.exercise_id))
  }
  for (const pref of await db.restPrefs.toArray()) ids.add(pref.exercise_id)
  return ids
}

/** Point everything at the new ids, and drop the old custom exercises. */
async function renameExercises(renames: Map<string, string>): Promise<void> {
  const to = (id: string) => renames.get(id) ?? id
  await db.transaction('rw', db.workouts, db.customExercises, db.restPrefs, db.kv, async () => {
    const workouts = await db.workouts
      .where('exercise_ids')
      .anyOf([...renames.keys()])
      .distinct()
      .toArray()
    await db.workouts.bulkPut(
      workouts.map((w): StoredWorkout => {
        const exercises = w.exercises.map((we) => ({ ...we, exercise_id: to(we.exercise_id) }))
        return {
          ...w,
          exercises,
          exercise_ids: [...new Set(exercises.map((we) => we.exercise_id))],
        }
      }),
    )

    const routine = await getStoredRoutine()
    if (routine) {
      const days = routine.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((e) => ({ ...e, exercise_id: to(e.exercise_id) })),
      }))
      await db.kv.put({ key: 'routine', value: { ...routine, days } })
    }

    for (const [from, target] of renames) {
      const pref = await db.restPrefs.get(from)
      if (pref && !(await db.restPrefs.get(target))) {
        await db.restPrefs.put({ ...pref, exercise_id: target })
      }
      await db.restPrefs.delete(from)
    }
    await db.customExercises.bulkDelete([...renames.keys()])
  })
}
