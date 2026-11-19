/**
 * The exercise library: exercises.json and the exercise drawings, served with the app from
 * /exercises/ (built by scripts/fetch-exercises.sh). Loaded once, searched in memory.
 */
import type { ExerciseSummary, ExerciseFilters } from './types'

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
  images: string[]
}

export function fromRaw(raw: RawExercise): ExerciseSummary {
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
  }
}

async function fetchExercises(file: string): Promise<Map<string, ExerciseSummary>> {
  const response = await fetch(`${BASE}/${file}`)
  if (!response.ok) throw new Error(`Couldn't load the exercise library (${response.status})`)
  const raw = (await response.json()) as RawExercise[]
  return new Map(raw.map((e) => [e.id, fromRaw(e)]))
}

let loading: Promise<Map<string, ExerciseSummary>> | undefined
let loadingRetired: Promise<Map<string, ExerciseSummary>> | undefined

/** The library by id. Fetched once per app session. */
export function loadLibrary(): Promise<Map<string, ExerciseSummary>> {
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
export function loadRetired(): Promise<Map<string, ExerciseSummary>> {
  loadingRetired ??= fetchExercises('retired.json').catch((e: unknown) => {
    loadingRetired = undefined
    throw e
  })
  return loadingRetired
}

export function setLibraryForTests(
  exercises: ExerciseSummary[] | null,
  retired: ExerciseSummary[] = [],
): void {
  loading = exercises ? Promise.resolve(new Map(exercises.map((e) => [e.id, e]))) : undefined
  loadingRetired = exercises ? Promise.resolve(new Map(retired.map((e) => [e.id, e]))) : undefined
}

export type ExerciseSearch = { q?: string; muscle?: string; equipment?: string }

/**
 * Other words for the library's muscles, gym slang included: "abs" or "booty" find the
 * exercises for those muscles. Add a word here; a muscle's own name (or its first letters,
 * from 3) works anyway.
 */
const MUSCLE_WORDS: Record<string, string[]> = {
  // abdominals
  abs: ['abdominals'],
  core: ['abdominals'],
  sixpack: ['abdominals'],
  'six-pack': ['abdominals'],
  stomach: ['abdominals'],
  obliques: ['abdominals'],
  // glutes
  glute: ['glutes'],
  gluteus: ['glutes'],
  booty: ['glutes'],
  butt: ['glutes'],
  // legs
  quad: ['quadriceps'],
  quads: ['quadriceps'],
  thighs: ['quadriceps', 'hamstrings'],
  ham: ['hamstrings'],
  hams: ['hamstrings'],
  hammies: ['hamstrings'],
  hamstring: ['hamstrings'],
  calf: ['calves'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  // upper body
  pec: ['chest'],
  pecs: ['chest'],
  pectorals: ['chest'],
  delt: ['shoulders'],
  delts: ['shoulders'],
  deltoids: ['shoulders'],
  shoulder: ['shoulders'],
  lat: ['lats'],
  back: ['middle back', 'lower back', 'lats'],
  trap: ['traps'],
  trapezius: ['traps'],
  neck: ['traps'],
  // arms
  bi: ['biceps'],
  bis: ['biceps'],
  bicep: ['biceps'],
  guns: ['biceps'],
  tri: ['triceps'],
  tris: ['triceps'],
  tricep: ['triceps'],
  arms: ['biceps', 'triceps', 'forearms'],
  forearm: ['forearms'],
  grip: ['forearms'],
}

/** Whether a search word names one of the exercise's primary muscles ("abs", "abdom", "quads"). */
function trains(exercise: ExerciseSummary, word: string): boolean {
  const muscles = exercise.primary_muscles
  return (
    (MUSCLE_WORDS[word] ?? []).some((m) => muscles.includes(m)) ||
    // Part of the muscle's own name, from 3 letters ("ab" would be abs and abductors too).
    (word.length >= 3 && muscles.some((m) => m.startsWith(word)))
  )
}

/**
 * Search: every word must appear in the name ("incline curl" finds "Incline Dumbbell Curl"), or
 * name one of its primary muscles ("abs", "chest", "quads"). Names starting with the query come
 * first, then other name matches, then exercises found by their muscle; A–Z within each.
 * `muscle` (the filter) matches primary muscles only.
 */
export function searchExercises(
  exercises: Iterable<ExerciseSummary>,
  { q, muscle, equipment }: ExerciseSearch,
): ExerciseSummary[] {
  const query = q?.trim().toLowerCase() ?? ''
  const words = query.split(/\s+/).filter(Boolean)
  const inName = (e: ExerciseSummary, w: string) => e.name.toLowerCase().includes(w)
  const matches = [...exercises].filter(
    (e) =>
      words.every((w) => inName(e, w) || trains(e, w)) &&
      (!muscle || e.primary_muscles.includes(muscle)) &&
      (!equipment || e.equipment === equipment),
  )
  const rank = (e: ExerciseSummary) =>
    !query
      ? 0
      : e.name.toLowerCase().startsWith(query)
        ? 0
        : words.every((w) => inName(e, w))
          ? 1
          : 2
  return matches.sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  )
}

/** Values for the filters: every muscle and piece of equipment that occurs. */
export function filterValues(exercises: Iterable<ExerciseSummary>): ExerciseFilters {
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
