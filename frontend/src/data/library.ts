/**
 * The exercise library: exercises.json and the exercise drawings, served with the app from
 * /exercises/ (built by scripts/fetch-exercises.sh). Loaded once, searched in memory.
 */
import type { ExerciseDetail, ExerciseFilters, ExerciseSummary } from './types'

const BASE = '/exercises'

/** One record of the dataset's exercises.json. */
type RawExercise = {
  id: string
  name: string
  force: string | null
  level: string | null
  mechanic: string | null
  equipment: string | null
  category: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  images: string[]
}

export function fromRaw(raw: RawExercise): ExerciseDetail {
  const muscles = (list: string[]) => [...list].sort()
  const primary = muscles(raw.primaryMuscles)
  return {
    id: raw.id,
    name: raw.name,
    equipment: raw.equipment,
    category: raw.category,
    level: raw.level,
    mechanic: raw.mechanic,
    force: raw.force,
    is_custom: false,
    primary_muscles: primary,
    // A muscle listed as both counts as primary only.
    secondary_muscles: muscles(raw.secondaryMuscles.filter((m) => !primary.includes(m))),
    image_urls: raw.images.map((path) => `${BASE}/${path}`),
    instructions: raw.instructions,
  }
}

async function fetchExercises(file: string): Promise<Map<string, ExerciseDetail>> {
  const response = await fetch(`${BASE}/${file}`)
  if (!response.ok) throw new Error(`Couldn't load the exercise library (${response.status})`)
  const raw = (await response.json()) as RawExercise[]
  return new Map(raw.map((e) => [e.id, fromRaw(e)]))
}

let loading: Promise<Map<string, ExerciseDetail>> | undefined
let loadingRetired: Promise<Map<string, ExerciseDetail>> | undefined

/** The library by id. Fetched once per app session. */
export function loadLibrary(): Promise<Map<string, ExerciseDetail>> {
  loading ??= fetchExercises('exercises.json').catch((e: unknown) => {
    loading = undefined // allow a retry
    throw e
  })
  return loading
}

/**
 * Exercises that were in an earlier version of the library, by id (see
 * scripts/build-exercises.mjs). Only needed when your data still refers to one of them.
 */
export function loadRetired(): Promise<Map<string, ExerciseDetail>> {
  loadingRetired ??= fetchExercises('retired.json').catch((e: unknown) => {
    loadingRetired = undefined
    throw e
  })
  return loadingRetired
}

export function setLibraryForTests(
  exercises: ExerciseDetail[] | null,
  retired: ExerciseDetail[] = [],
): void {
  loading = exercises ? Promise.resolve(new Map(exercises.map((e) => [e.id, e]))) : undefined
  loadingRetired = exercises ? Promise.resolve(new Map(retired.map((e) => [e.id, e]))) : undefined
}

export function toSummary(exercise: ExerciseDetail): ExerciseSummary {
  const { instructions: _, ...summary } = exercise
  return summary
}

export type ExerciseSearch = { q?: string; muscle?: string; equipment?: string }

/**
 * Search like the old API did: every word must appear in the name ("incline curl" finds
 * "Incline Dumbbell Curl"); names starting with the query come first, then A–Z.
 * `muscle` matches primary muscles only.
 */
export function searchExercises(
  exercises: Iterable<ExerciseDetail>,
  { q, muscle, equipment }: ExerciseSearch,
): ExerciseSummary[] {
  const query = q?.trim().toLowerCase() ?? ''
  const words = query.split(/\s+/).filter(Boolean)
  const matches = [...exercises].filter((e) => {
    const name = e.name.toLowerCase()
    return (
      words.every((w) => name.includes(w)) &&
      (!muscle || e.primary_muscles.includes(muscle)) &&
      (!equipment || e.equipment === equipment)
    )
  })
  const rank = (e: ExerciseDetail) => (query && e.name.toLowerCase().startsWith(query) ? 0 : 1)
  return matches
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map(toSummary)
}

/** Values for the filters: every muscle and piece of equipment that occurs. */
export function filterValues(exercises: Iterable<ExerciseDetail>): ExerciseFilters {
  const muscles = new Set<string>()
  const equipment = new Set<string>()
  for (const e of exercises) {
    e.primary_muscles.forEach((m) => muscles.add(m))
    e.secondary_muscles.forEach((m) => muscles.add(m))
    if (e.equipment) equipment.add(e.equipment)
  }
  const sorted = (s: Set<string>) => [...s].sort()
  return { muscles: sorted(muscles), equipment: sorted(equipment) }
}
