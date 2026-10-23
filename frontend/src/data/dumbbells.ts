/**
 * Dumbbells: is the weight you log for an exercise one dumbbell, each of two, or both
 * together? Set once per exercise (on its page); the set card says "kg each" or "kg total" so
 * it's clear what to type. With two dumbbells logged as "each", volume counts both. Records
 * compare what you logged, so they're the same either way.
 *
 * The default comes from the list below: dumbbell exercises use two, logged as "each", except
 * the ones done with a single dumbbell. Only dumbbell exercises have a choice.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useExerciseLookup } from '../exercises'
import { db } from './db'
import type { ExerciseId, ExerciseSummary } from './types'

/** one: a single dumbbell · each: two, the weight of one · total: two, both together. */
export type DumbbellMode = 'one' | 'each' | 'total'
export type DumbbellChoice = { exercise_id: ExerciseId; mode: DumbbellMode }

/** How many times an exercise's logged weight counts in volume (1, or 2 for "each"). */
export type WeightCount = (exerciseId: ExerciseId) => number

/** Library dumbbell exercises done with a single dumbbell (sorted by hand). */
const ONE_DUMBBELL = new Set([
  'Concentration_Curls',
  'Goblet_Squat',
  'heel-elevated-goblet-squat',
  'One-Arm_Dumbbell_Row',
  'Dumbbell_One-Arm_Triceps_Extension', // Single Arm Dumbbell Tricep Extension
  'single-dumbbell-skullcrusher',
  'single-leg-romanian-deadlift',
  'dumbbell-glute-bridge',
  'dumbbell-hip-thrust',
  'Standing_Dumbbell_Triceps_Extension', // Dumbbell Overhead Tricep Extension: both hands
  'Dumbbell_Side_Bend',
  'dumbbell-sumo-deadlift',
  'Plie_Dumbbell_Squat', // Dumbbell Sumo Squat
  'weighted-russian-twist',
])

/** The exercise's mode: your choice, else the default; null when it isn't a dumbbell exercise. */
export function dumbbellMode(
  exercise: Pick<ExerciseSummary, 'id' | 'equipment'>,
  chosen?: DumbbellMode,
): DumbbellMode | null {
  if (exercise.equipment !== 'dumbbell') return null
  return chosen ?? (ONE_DUMBBELL.has(exercise.id) ? 'one' : 'each')
}

export const countOf = (mode: DumbbellMode | null) => (mode === 'each' ? 2 : 1)

/** "kg each", "kg total" or just "kg": what the weight you type means. */
export const weightUnit = (mode: DumbbellMode | null) =>
  mode === 'each' ? 'kg each' : mode === 'total' ? 'kg total' : 'kg'

export async function chooseDumbbellMode(exerciseId: ExerciseId, mode: DumbbellMode) {
  await db.dumbbellModes.put({ exercise_id: exerciseId, mode })
}

/** Your choices, live (undefined while loading). */
function useChoices(): Map<ExerciseId, DumbbellMode> | undefined {
  const rows = useLiveQuery(() => db.dumbbellModes.toArray(), [])
  return useMemo(() => rows && new Map(rows.map((r) => [r.exercise_id, r.mode])), [rows])
}

/** One exercise's mode, live; null for exercises without dumbbells, undefined while loading. */
export function useDumbbellMode(
  exercise: Pick<ExerciseSummary, 'id' | 'equipment'>,
): DumbbellMode | null | undefined {
  const choices = useChoices()
  return choices && dumbbellMode(exercise, choices.get(exercise.id))
}

/** How many times each exercise's weight counts in volume, live (undefined while loading). */
export function useWeightCount(): WeightCount | undefined {
  const choices = useChoices()
  const lookup = useExerciseLookup()
  return useMemo(
    () =>
      choices && lookup && ((id: ExerciseId) => countOf(dumbbellMode(lookup(id), choices.get(id)))),
    [choices, lookup],
  )
}
