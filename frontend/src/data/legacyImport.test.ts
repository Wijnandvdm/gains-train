// Same cases as the former backend's tests/test_legacy_sheet.py and test_legacy_loader.py.
import { describe, expect, it } from 'vitest'
import { LIBRARY, libraryExercise } from '../test/library'
import { db } from './db'
import { importLegacyLog, LegacyImportError, parseCsv, parseLegacyLog } from './legacyImport'

const HEADER = 'Date,Day,Exercise,Set,Weight (kg),Reps,Muscle Group,Notes,\n'
const parse = (body: string, header = HEADER) => parseLegacyLog(header + body)

describe('CSV', () => {
  it('handles quotes, commas and line breaks inside fields', () => {
    expect(parseCsv('a,"b, c","say ""hi""",\r\n"multi\nline",2\n')).toEqual([
      ['a', 'b, c', 'say "hi"', ''],
      ['multi\nline', '2'],
    ])
  })
})

describe('parsing the legacy sheet', () => {
  it('groups sets into workouts and exercises', () => {
    const r = parse(
      '2026-07-19,Day1,Hack Squat,1,60.0,8,Legs,,\n2026-07-19,Day1,Hack Squat,2,60.0,7,Legs,,\n2026-07-19,Day1,Leg Curl,1,102.0,12,Legs,,\n2026-07-22,Day2,Lat Pulldown,1,70.0,14,Back & Triceps,,\n',
    )
    expect(r.workouts.map((w) => w.import_key)).toEqual([
      'legacy-sheet:2026-07-19:Day1',
      'legacy-sheet:2026-07-22:Day2',
    ])
    expect(r.workouts[0]!.name).toBe('Day1 · Legs')
    expect(r.workouts[0]!.exercises[0]!.sets.map((s) => [s.position, s.weight_kg, s.reps])).toEqual(
      [
        [1, 60, 8],
        [2, 60, 7],
      ],
    )
    expect(r.warnings).toEqual([])
  })

  it('keeps a session past midnight as one workout; splits same-day different days', () => {
    expect(
      parse('2026-07-23,Day3,Curl,1,14,12,Arms,,\n2026-07-24,Day3,Curl,2,14,12,Arms,,\n').workouts,
    ).toHaveLength(1)
    expect(
      parse('2026-09-07,Day1,A,1,97,10,Legs,,\n2026-09-07,Day2,B,1,90,12,Back,,\n').workouts.map(
        (w) => w.day_code,
      ),
    ).toEqual(['Day1', 'Day2'])
    expect(
      parse('2026-08-01,Day3,C,1,8.8,12,Arms,,\n2026-08-07,Day3,C,1,10,12,Arms,,\n').workouts,
    ).toHaveLength(2)
  })

  it('fills a missing date from the row above; imports sets without reps', () => {
    const r = parse(
      '2026-09-15,Day2,Lat Pulldown,1,85.0,10,Back,,\n,Day2,Lat Pulldown,2,85.0,,Back,,\n',
    )
    expect(r.workouts).toHaveLength(1)
    expect(r.workouts[0]!.exercises[0]!.sets[1]!.reps).toBeNull()
    expect(r.warnings).toEqual([
      'line 3: missing date, used 2026-09-15 from the row above',
      'line 3: Lat Pulldown has no reps, imported without them',
    ])
  })

  it('puts Notes on the set and the unnamed column on the workout', () => {
    const r = parse(
      '2026-09-07,Day2,Lat,2,85.0,8,Back,corrected form,\n2026-09-07,Day2,Lat,3,85.0,8,Back,,machine died :(\n',
    )
    expect(r.workouts[0]!.exercises[0]!.sets.map((s) => s.notes)).toEqual(['corrected form', null])
    expect(r.workouts[0]!.notes).toEqual(['machine died :('])
  })

  it('skips invalid rows with a warning, ignores blank rows, rejects other files', () => {
    const r = parse(
      '2026-09-07,Day2,Lat,1,heavy,8,Back,,\n2026-09-07,Day2,Lat,2,85.0,8.5,Back,,\nnot-a-date,Day2,Lat,3,85.0,8,Back,,\n,,,,,,,,\n2026-09-07,Day2,Lat,4,85.0,8,Back,,\n',
    )
    expect(r.workouts[0]!.exercises[0]!.sets).toHaveLength(1)
    expect(r.warnings).toEqual([
      "line 2: skipped, not a number: 'heavy'",
      "line 3: skipped, not a whole number: '8.5'",
      "line 4: skipped, invalid date 'not-a-date'",
    ])
    expect(() => parse('', 'Exercise,Muscle Group,Sets Logged\n')).toThrow(LegacyImportError)
  })
})

describe('importing into the device', () => {
  const BULGARIAN = libraryExercise('bulgarian-split-squat', 'Bulgarian Split Squat')
  const library = new Map([...LIBRARY, BULGARIAN].map((e) => [e.id, e]))
  const SHEET =
    '2026-07-19,Day1,Leg Curl,1,102.0,12,Legs,,\n2026-07-19,Day1,Leg Curl,2,105.0,10,Legs,,\n2026-07-19,Day1,Bulgarian Split Squat,1,22.0,10,Legs,,leg day\n2026-07-23,Day3,incline dumbbell curl,1,14.0,12,Arms,good pump,\n'

  it('creates workouts, mapping names by the mapping or an exact library name', async () => {
    const result = await importLegacyLog(parse(SHEET), library)
    expect([result.created, result.updated, result.sets]).toEqual([2, 0, 4])
    expect(result.exerciseMap).toEqual({
      'Leg Curl': 'Seated Leg Curl',
      'Bulgarian Split Squat': 'Bulgarian Split Squat',
      'incline dumbbell curl': 'Incline Dumbbell Curl',
    })
    const workouts = await db.workouts.orderBy('performed_on').toArray()
    expect(workouts.map((w) => [w.name, w.status, w.notes])).toEqual([
      ['Day1 · Legs', 'completed', 'leg day'],
      ['Day3 · Arms', 'completed', null],
    ])
    expect(await db.customExercises.count()).toBe(0)
  })

  it('creates a custom exercise for a name the library lacks', async () => {
    const mapping = {
      library: { 'Leg Curl': 'Seated_Leg_Curl' },
      custom: {
        'Bulgarian Split Squat': {
          equipment: 'dumbbell',
          category: 'strength',
          level: null,
          mechanic: 'compound',
          force: 'push',
          primary_muscles: ['glutes', 'quadriceps'],
          secondary_muscles: [],
          instructions: [],
        },
      },
    }
    const withoutIt = new Map(LIBRARY.map((e) => [e.id, e]))
    const result = await importLegacyLog(parse(SHEET), withoutIt, mapping)
    expect(result.exerciseMap['Bulgarian Split Squat']).toBe('Bulgarian Split Squat (custom)')
    expect((await db.customExercises.toArray()).map((e) => e.name)).toEqual([
      'Bulgarian Split Squat',
    ])
  })

  it('re-importing updates in place, without duplicates', async () => {
    await importLegacyLog(parse(SHEET), library)
    const result = await importLegacyLog(parse(SHEET.replace('105.0,10', '107.5,9')), library)
    expect([result.created, result.updated]).toEqual([0, 2])
    expect(await db.workouts.count()).toBe(2)
    expect(await db.customExercises.count()).toBe(0)
    const weights = (await db.workouts.toArray()).flatMap((w) =>
      w.exercises.flatMap((e) => e.sets.map((s) => s.weight_kg)),
    )
    expect(weights).toContain(107.5)
    expect(weights).not.toContain(105)
  })

  it('lists every unmapped name and writes nothing', async () => {
    const body = SHEET + '2026-07-25,Day1,Mystery Machine,1,50,10,Legs,,\n'
    const mapping = { library: { 'Leg Curl': 'Does_Not_Exist' }, custom: {} }
    await expect(importLegacyLog(parse(body), library, mapping)).rejects.toThrow(
      /'Leg Curl' → library id 'Does_Not_Exist' doesn't exist[\s\S]*'Mystery Machine' isn't mapped/,
    )
    expect(await db.workouts.count()).toBe(0)
  })

  it('does not guess between two library exercises with the same name', async () => {
    const twice = new Map([...library, ['Other', libraryExercise('Other', 'Seated Leg Curl')]])
    await expect(
      importLegacyLog(parse('2026-07-19,Day1,Seated Leg Curl,1,100,10,Legs,,\n'), twice, {
        library: {},
        custom: {},
      }),
    ).rejects.toThrow("'Seated Leg Curl' isn't mapped")
  })
})
