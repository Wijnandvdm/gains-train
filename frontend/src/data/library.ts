/**
 * The exercise library: free-exercise-db's exercises.json and photos, served with the app
 * from /exercises/ (downloaded by scripts/fetch-exercises.sh). Loaded once, searched in memory.
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

let loading: Promise<Map<string, ExerciseDetail>> | undefined

/** The library by id. Fetched once per app session (and cached by the service worker). */
export function loadLibrary(): Promise<Map<string, ExerciseDetail>> {
  loading ??= fetch(`${BASE}/exercises.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Couldn't load the exercise library (${r.status})`)
      return r.json() as Promise<RawExercise[]>
    })
    .then((raw) => new Map(raw.map((e) => [e.id, fromRaw(e)])))
    .catch((e: unknown) => {
      loading = undefined // allow a retry
      throw e
    })
  return loading
}

/** For tests: use this library instead of fetching one. */
export function setLibraryForTests(exercises: ExerciseDetail[] | null): void {
  loading = exercises ? Promise.resolve(new Map(exercises.map((e) => [e.id, e]))) : undefined
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

/** Values for the filter chips: every muscle, equipment and category that occurs. */
export function filterValues(exercises: Iterable<ExerciseDetail>): ExerciseFilters {
  const muscles = new Set<string>()
  const equipment = new Set<string>()
  const categories = new Set<string>()
  for (const e of exercises) {
    e.primary_muscles.forEach((m) => muscles.add(m))
    e.secondary_muscles.forEach((m) => muscles.add(m))
    if (e.equipment) equipment.add(e.equipment)
    if (e.category) categories.add(e.category)
  }
  const sorted = (s: Set<string>) => [...s].sort()
  return { muscles: sorted(muscles), equipment: sorted(equipment), categories: sorted(categories) }
}
