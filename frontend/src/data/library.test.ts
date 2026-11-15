/// <reference types="node" />
// Node's fs is used only to read the downloaded dataset from disk in this test.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIBRARY } from '../test/library'
import { filterValues, fromRaw, searchExercises } from './library'

const names = (q: Parameters<typeof searchExercises>[1]) =>
  searchExercises(LIBRARY, q).map((e) => e.name)

describe('exercise library search', () => {
  it('lists everything A–Z without a query', () => {
    expect(names({})).toEqual([...LIBRARY.map((e) => e.name)].sort())
  })

  it('requires every word, case-insensitive', () => {
    expect(names({ q: 'leg curl' })).toEqual(['Lying Leg Curls', 'Seated Leg Curl'])
    expect(names({ q: 'SEATED curl' })).toEqual(['Seated Leg Curl'])
    expect(names({ q: 'curl deadlift' })).toEqual([])
  })

  it('ranks names starting with the query first', () => {
    expect(names({ q: 'curl' })[0]).toBe('Curl 50% Test')
  })

  it('finds exercises by the muscle they train, in plain or gym words', () => {
    const legCurls = ['Lying Leg Curls', 'Romanian Deadlift', 'Seated Leg Curl'] // all hamstrings
    expect(names({ q: 'hamstrings' })).toEqual(legCurls)
    expect(names({ q: 'hams' })).toEqual(legCurls)
    expect(names({ q: 'hamstr' })).toEqual(legCurls) // part of the muscle's name
    expect(names({ q: 'glutes' })).toEqual([]) // only a secondary muscle anywhere
    expect(names({ q: 'ha' })).toEqual([]) // too short to mean a muscle
    // Slang works too: "hammies", "legs" (everything for the legs).
    expect(names({ q: 'hammies' })).toEqual(legCurls)
    expect(names({ q: 'legs' })).toEqual(legCurls)
    // Words combine: a name word and a muscle.
    expect(names({ q: 'seated hams' })).toEqual(['Seated Leg Curl'])
  })

  it('lists name matches before exercises found by their muscle', () => {
    const found = names({ q: 'biceps' })
    expect(found.length).toBeGreaterThan(0)
    const byName = found.filter((n) => n.toLowerCase().includes('biceps'))
    expect(found.slice(0, byName.length)).toEqual(byName)
  })

  it('treats special characters literally', () => {
    expect(names({ q: '50%' })).toEqual(['Curl 50% Test'])
    expect(names({ q: '_' })).toEqual([])
  })

  it('filters by primary muscle and equipment', () => {
    expect(names({ muscle: 'glutes' })).toEqual([]) // only a secondary muscle anywhere
    expect(names({ muscle: 'hamstrings', equipment: 'machine' })).toEqual([
      'Lying Leg Curls',
      'Seated Leg Curl',
    ])
  })

  it('collects filter values', () => {
    expect(filterValues(LIBRARY)).toEqual({
      muscles: ['biceps', 'forearms', 'glutes', 'hamstrings', 'lower back'],
      equipment: ['barbell', 'dumbbell', 'e-z curl bar', 'machine'],
    })
  })

  it('normalises dataset records (a muscle listed twice counts as primary)', () => {
    const e = fromRaw({
      id: 'X',
      name: 'X',
      force: null,
      level: null,
      mechanic: null,
      equipment: null,
      category: null,
      primaryMuscles: ['biceps'],
      secondaryMuscles: ['biceps', 'forearms'],
      images: ['X/0.jpg'],
    })
    expect(e.secondary_muscles).toEqual(['forearms'])
    expect(e.image_urls).toEqual(['/exercises/X/0.jpg'])
  })
})

// The real dataset, if downloaded (scripts/fetch-exercises.sh).
const REAL = resolve(process.cwd(), 'public/exercises/exercises.json') // tests run in frontend/
describe.skipIf(!existsSync(REAL))('the downloaded dataset', () => {
  it('parses completely: unique ids and a drawing per pose', () => {
    const exercises = (
      JSON.parse(readFileSync(REAL, 'utf8')) as Parameters<typeof fromRaw>[0][]
    ).map(fromRaw)
    expect(exercises.length).toBe(302)
    expect(new Set(exercises.map((e) => e.id)).size).toBe(302)
    expect(exercises.every((e) => e.image_urls.length === 2)).toBe(true)
    const ids = new Set(exercises.map((e) => e.id))
    const yours = [
      'Hack_Squat',
      'Seated_Leg_Curl',
      'Leg_Extensions',
      'bulgarian-split-squat',
      'Wide-Grip_Lat_Pulldown',
      'Seated_Cable_Rows',
      'Triceps_Pushdown',
      'Cable_Rope_Overhead_Triceps_Extension',
      'Dumbbell_Bench_Press',
      'Incline_Dumbbell_Press',
      'Incline_Dumbbell_Curl',
      'Preacher_Curl',
    ]
    expect(yours.filter((id) => !ids.has(id))).toEqual([])
  })
})
