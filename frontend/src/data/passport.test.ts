import { describe, expect, it } from 'vitest'
import { set, workout } from '../test/device'
import { easterSunday, passport } from './passport'

const ride = (id: string, day: string, sets: [number, number][], exercise = 'Rows') =>
  workout({ id, performed_on: day }, [
    [exercise, sets.map(([kg, reps], i) => set(`${id}-${i}`, `${id}-we`, i + 1, kg, reps))],
  ])

const LINE = { target: 1, depot: new Set<string>(), today: '2026-09-30' }
/** A three-exercise library; custom exercises (anything else) don't count as exploring. */
const LIB = new Set(['Rows', 'Curl', 'Squat'])
const earned = (p: ReturnType<typeof passport>) =>
  p.stamps.filter((s) => s.earnedOn).map((s) => `${s.id} ${s.earnedOn} ${s.earnedBy}`)

describe('the passport', () => {
  it('stamps rides, weight hauled, PRs and streaks, with when and which workout', () => {
    const workouts = [
      ride('a', '2026-09-01', [
        [100, 10],
        [100, 10],
      ]), // first time: no PR
      ride('b', '2026-09-08', [
        [100, 12],
        [110, 10],
      ]), // more reps, then heavier: one PR
      ride('c', '2026-09-15', [[100, 10]]), // nothing beaten
      ride('d', '2026-09-22', [[1000, 38]]), // 38 t in one go (and a PR)
    ]
    const p = passport(workouts, LINE, LIB)
    expect(earned(p)).toEqual([
      'rides-1 2026-09-01 a',
      'weight-40 2026-09-22 d',
      'weight-coal 2026-09-22 d', // Burning coal: 10 t or more in one workout
      'prs-1 2026-09-08 b',
      'prs-double 2026-09-22 d', // Double track: 1000 kg, ten times the start
      'streak-4 2026-09-22 d', // a ride every week, target 1
    ])
    expect(p.recordWorkouts).toEqual(new Set(['b', 'd']))
    expect(p.progress).toEqual({
      rides: 4,
      weight: 43,
      prs: 2,
      streak: 4,
      steam: 2, // a → b stronger, c wasn't, c → d stronger
      explorer: 1,
      hours: 0, // no start times
      express: 1, // a week apart: never two days in a row
      holiday: 0,
      features: 0,
      big3: 0,
    })
  })

  it('counts one PR per exercise per workout, per exercise', () => {
    const workouts = [
      ride('a', '2026-09-01', [[50, 10]], 'Curl'),
      ride('b', '2026-09-01', [[80, 10]], 'Rows'),
      ride(
        'c',
        '2026-09-02',
        [
          [55, 10],
          [60, 10],
          [65, 10],
        ],
        'Curl',
      ), // three better sets: 1 PR
      ride('d', '2026-09-02', [[80, 9]], 'Rows'), // not a PR
    ]
    expect(passport(workouts, LINE, LIB).progress.prs).toBe(1)
  })

  it('never counts a PR in the first session of an exercise', () => {
    const first = ride('a', '2026-09-01', [
      [50, 10],
      [60, 10],
      [70, 10],
    ]) // climbing sets
    expect(passport([first], LINE, LIB).progress.prs).toBe(0)
  })

  it('keeps a streak stamp after the streak ends, and skips unfinished workouts', () => {
    const weekly = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-09-14']
    const workouts = [
      ...weekly.map((d, i) => ride(`w${i}`, d, [[10, 10]])),
      { ...ride('open', '2026-09-15', [[10, 10]]), status: 'in_progress' as const },
    ]
    const p = passport(workouts, LINE, LIB)
    expect(p.stamps.find((s) => s.id === 'streak-4')?.earnedOn).toBe('2026-08-24')
    expect(p.progress).toMatchObject({ rides: 5, streak: 4 })
  })

  it('stamps the whole network once every library exercise is done', () => {
    const workouts = [
      ride('a', '2026-09-01', [[50, 10]], 'Rows'),
      ride('b', '2026-09-02', [[20, 10]], 'custom-1'), // your own exercise: not exploring
      ride('c', '2026-09-03', [[20, 10]], 'Curl'),
      ride('d', '2026-09-04', [[20, 10]], 'Rows'), // done before
      ride('e', '2026-09-05', [[60, 10]], 'Squat'), // the last one
    ]
    const p = passport(workouts, LINE, LIB)
    expect(p.stamps.find((s) => s.id === 'explorer-all')).toMatchObject({
      title: 'The whole network',
      goal: 3,
      badge: 'All',
      earnedOn: '2026-09-05',
      earnedBy: 'e',
    })
    expect(p.progress.explorer).toBe(3)
  })

  it('has every stamp still to earn on day one', () => {
    const p = passport([], LINE, LIB)
    expect(p.stamps).toHaveLength(64)
    expect(earned(p)).toEqual([])
  })
})

describe('the big three', () => {
  const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
  const SQUAT = 'Barbell_Full_Squat'

  it('stamps bench, squat and deadlift all at a weight, when the last one gets there', () => {
    const p = passport(
      [
        ride('bench', '2026-09-01', [[60, 5]], BENCH),
        ride('squat', '2026-09-02', [[70, 5]], SQUAT),
        ride('incline', '2026-09-03', [[200, 5]], 'Barbell_Incline_Bench_Press_-_Medium_Grip'), // not the bench
        ride('deadlift', '2026-09-04', [[65, 5]], 'Barbell_Deadlift'), // all three at 60 now
        ride('bench-80', '2026-09-08', [[80, 3]], BENCH),
        ride('squat-80', '2026-09-09', [[80, 3]], SQUAT),
        ride('sumo', '2026-09-10', [[85, 1]], 'Sumo_Deadlift'), // sumo counts as the deadlift
        ride('deadlift-100', '2026-09-11', [[100, 1]], 'Barbell_Deadlift'),
      ],
      LINE,
      LIB,
    )
    expect(earned(p).filter((s) => s.startsWith('big3'))).toEqual([
      'big3-60 2026-09-04 deadlift',
      'big3-80 2026-09-10 sumo',
    ])
    expect(p.progress.big3).toBe(80) // the lightest of the three
    expect(p.stamps.find((s) => s.id === 'big3-120')!.title).toBe('Iron horse')
    // How far the next ones are: which of the three got to their weight.
    const lifts = (id: string) => p.stamps.find((s) => s.id === id)!.lifts
    expect(lifts('big3-100')).toEqual(['deadlift'])
    expect(lifts('big3-120')).toEqual([])
  })

  it('tells where the famous rides went', () => {
    const p = passport([], LINE, LIB)
    expect(p.stamps.find((s) => s.title === 'Orient Express')!.note).toMatch(/Paris to Istanbul/)
    expect(p.stamps.find((s) => s.title === 'Trans-Siberian')!.note).toMatch(/Vladivostok/)
  })
})

describe('the Full steam ahead stamps', () => {
  const steam = (p: ReturnType<typeof passport>) => earned(p).filter((s) => s.startsWith('steam'))

  it('stamps one exercise getting stronger every week, weeks in a row', () => {
    const workouts = [
      ride('a', '2026-08-31', [[60, 8]]),
      ride('b', '2026-09-07', [[60, 9]]), // more reps
      ride('c', '2026-09-14', [
        [60, 8],
        [62.5, 8],
      ]), // heavier (the second set)
      ride('d', '2026-09-21', [[65, 6]]), // heavier
    ]
    const p = passport(workouts, LINE, LIB)
    expect(steam(p)).toEqual(['steam-3 2026-09-14 c', 'steam-4 2026-09-21 d'])
    expect(p.progress.steam).toBe(4)
  })

  it('compares with the whole week before, however many times you trained it', () => {
    const workouts = [
      ride('a', '2026-08-31', [[60, 8]]),
      ride('b', '2026-09-03', [[60, 10]]), // same week: this is the one to beat
      ride('c', '2026-09-07', [[60, 9]]), // beats a, not b: not stronger
      ride('d', '2026-09-14', [[60, 10]]),
    ]
    expect(passport(workouts, LINE, LIB).progress.steam).toBe(2) // c → d
  })

  it('starts over after a week without the exercise, or a week that was no stronger', () => {
    const workouts = [
      ride('a', '2026-08-31', [[60, 8]]),
      ride('b', '2026-09-07', [[60, 9]]),
      // the week of 14 September: no Rows
      ride('c', '2026-09-21', [[60, 10]]),
      ride('d', '2026-09-28', [[60, 10]]), // the same as last week
      ride('e', '2026-10-05', [[60, 11]]),
    ]
    expect(passport(workouts, LINE, LIB).progress.steam).toBe(2)
  })

  it('counts each exercise on its own', () => {
    const workouts = [
      ride('a', '2026-08-31', [[60, 8]], 'Rows'),
      ride('b', '2026-09-01', [[20, 8]], 'Curl'),
      ride('c', '2026-09-07', [[20, 9]], 'Curl'), // Rows skipped this week
      ride('d', '2026-09-14', [[62.5, 8]], 'Rows'),
      ride('e', '2026-09-15', [[20, 10]], 'Curl'),
    ]
    const p = passport(workouts, LINE, LIB)
    expect(steam(p)).toEqual(['steam-3 2026-09-15 e'])
  })
})

/** Stamps you can earn again: "id earnedOn earnedBy ×times (last againBy)". */
const counted = (p: ReturnType<typeof passport>, kind: string) =>
  p.stamps
    .filter((s) => s.kind === kind && s.earnedOn && s.times !== undefined)
    .map((s) => `${s.id} ${s.earnedOn} ${s.earnedBy} ×${s.times} (last ${s.againBy})`)

/** A ride started at a time on the phone's clock (any time zone). */
const at = (id: string, day: string, hour: number, minute = 0) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return workout(
    { id, performed_on: day, started_at: new Date(y, m - 1, d, hour, minute).toISOString() },
    [['Rows', [set(`${id}-s`, `${id}-we`, 1, 50, 10)]]],
  )
}

describe('the stamps you can earn again', () => {
  it('stamps your first night train and early commute, once', () => {
    const p = passport(
      [
        at('late', '2026-09-01', 21, 30),
        at('small-hours', '2026-09-03', 1),
        at('dawn', '2026-09-05', 6, 45),
        at('morning', '2026-09-07', 7), // 7:00 is no longer early
        at('evening', '2026-09-09', 20, 59), // not night yet
        ride('imported', '2026-09-11', [[50, 10]]), // no start time: neither
      ],
      LINE,
      LIB,
    )
    // (The week and 7-in-a-row ones are tested below.)
    expect(counted(p, 'hours').filter((s) => !/-(week|7) /.test(s))).toEqual([
      'hours-night 2026-09-01 late ×1 (last late)', // once: the first one unlocks it
      'hours-early 2026-09-05 dawn ×1 (last dawn)',
    ])
    expect(p.progress.hours).toBe(3)
  })

  it('stamps a week of night trains, and seven nights in a row', () => {
    const nights = ['14', '15', '16', '17', '18', '19', '20'].map((d) =>
      at(`n${d}`, `2026-09-${d}`, 22),
    )
    const p = passport(
      [
        at('mon', '2026-09-07', 22),
        at('morning', '2026-09-08', 9), // not at night: doesn't count for the week
        at('wed', '2026-09-09', 23), // the 2nd night of the week: the weekly goal of 2
        ...nights, // a night every day: a week reached, and 7 in a row
      ],
      { ...LINE, target: 2 },
      LIB,
    )
    expect(counted(p, 'hours').filter((s) => s.startsWith('hours-night-'))).toEqual([
      'hours-night-week 2026-09-09 wed ×2 (last n15)',
      'hours-night-7 2026-09-20 n20 ×1 (last n20)',
    ])
    expect(p.stamps.find((s) => s.id === 'hours-night-week')!.detail).toMatch(/2 workouts/)
  })

  it('stamps workouts of two hours or more', () => {
    const long = (id: string, start: string, end: string | null) =>
      workout({ id, performed_on: start.slice(0, 10), started_at: start, ended_at: end }, [
        ['Rows', [set(`${id}-s`, `${id}-we`, 1, 50, 10)]],
      ])
    const p = passport(
      [
        long('short', '2026-09-01T17:00:00Z', '2026-09-01T18:30:00Z'),
        long('just', '2026-09-02T17:00:00Z', '2026-09-02T19:00:00Z'), // exactly two hours
        long('epic', '2026-09-03T17:00:00Z', '2026-09-03T20:15:00Z'),
        long('no-end', '2026-09-04T17:00:00Z', null), // no finish time known
      ],
      LINE,
      LIB,
    )
    expect(counted(p, 'hours').filter((s) => s.startsWith('hours-marathon'))).toEqual([
      'hours-marathon 2026-09-02 just ×2 (last epic)',
    ])
  })

  it('stamps days in a row, once per run', () => {
    const days = ['01', '02', '03', '10', '11', '12', '13', '14', '15', '16', '20']
    const p = passport(
      days.map((d) => ride(d, `2026-09-${d}`, [[50, 10]])),
      LINE,
      LIB,
    )
    expect(counted(p, 'express')).toEqual([
      'express-3 2026-09-03 03 ×2 (last 12)', // 1–3 Sept, and 10–16 Sept
      'express-5 2026-09-14 14 ×1 (last 14)',
      'express-7 2026-09-16 16 ×1 (last 16)',
      'express-weekend 2026-09-13 13 ×1 (last 13)', // Sat 12 and Sun 13; Sun 20 alone isn't one
    ])
    expect(p.progress.express).toBe(7)
  })

  it('stamps Mondays in a row, once per run', () => {
    // Mondays in September and October 2026: 7, 14, 21, 28, then 5, 12, 19 and 26 October.
    const mondays = ['09-07', '09-14', '09-21', '09-28', '10-12', '10-19', '10-26', '11-02']
    const p = passport(
      [
        ...mondays.map((d) => ride(d, `2026-${d}`, [[50, 10]])),
        ride('tuesday', '2026-10-06', [[50, 10]]), // the 5th of October was skipped: a new run
      ],
      LINE,
      LIB,
    )
    expect(counted(p, 'express').filter((s) => s.startsWith('express-mondays'))).toEqual([
      'express-mondays 2026-09-28 09-28 ×2 (last 11-02)',
    ])
  })

  it('stamps holidays, and your train turning a year older', () => {
    const p = passport(
      [
        ride('first', '2025-01-01', [[50, 10]]), // New Year's Day, and the train's first ride
        ride('kings', '2025-04-26', [[50, 10]]), // 27 April 2025 was a Sunday
        ride('boxing', '2025-12-26', [[50, 10]]),
        ride('ny', '2026-01-01', [[50, 10]]), // a year later: New Year and a birthday
        ride('ny-again', '2026-01-01', [[60, 10]]), // the same day: counted once
        ride('easter', '2026-04-06', [[50, 10]]), // Easter Monday
        ride('leap', '2028-02-29', [[50, 10]]),
      ],
      LINE,
      LIB,
    )
    expect(counted(p, 'holiday')).toEqual([
      'holiday-new-year 2025-01-01 first ×2 (last ny)',
      'holiday-easter 2026-04-06 easter ×1 (last easter)',
      'holiday-kings-day 2025-04-26 kings ×1 (last kings)',
      'holiday-christmas 2025-12-26 boxing ×1 (last boxing)',
      'holiday-leap-day 2028-02-29 leap ×1 (last leap)',
      'holiday-birthday 2026-01-01 ny ×1 (last ny)',
    ])
    expect(p.progress.holiday).toBe(6)
  })

  it('stamps breaking through a plateau, not a PR after a break', () => {
    const p = passport(
      [
        ride('start', '2026-01-05', [[100, 10]]),
        ride('same-1', '2026-01-12', [[100, 10]]),
        ride('same-2', '2026-01-19', [[100, 10]]),
        ride('same-3', '2026-02-02', [[100, 10]]),
        ride('through', '2026-03-09', [[100, 11]]), // 9 weeks and 3 sessions without a PR
        ride('next', '2026-03-16', [[105, 10]]), // a PR, but the plateau was a week ago
        // Squats: a PR months later, but without training them in between (a break).
        ride('squat', '2026-01-05', [[60, 10]], 'Squat'),
        ride('squat-back', '2026-04-06', [[65, 10]], 'Squat'),
      ],
      LINE,
      LIB,
    )
    expect(counted(p, 'prs')).toEqual(['prs-plateau 2026-03-09 through ×1 (last through)'])
  })

  it('stamps doubling your starting weight, once per exercise', () => {
    const p = passport(
      [
        ride('rows-start', '2026-01-05', [
          [30, 10],
          [40, 8], // the starting weight: the heaviest of the first session
        ]),
        ride('rows-60', '2026-03-02', [[60, 8]]), // 1.5×: not yet
        ride('rows-80', '2026-05-04', [[80, 5]]), // doubled
        ride('rows-100', '2026-06-01', [[100, 3]]), // already stamped for rows
        ride('curl-start', '2026-01-06', [[10, 10]], 'Curl'),
        ride('curl-20', '2026-06-02', [[20, 8]], 'Curl'), // doubled too
      ],
      LINE,
      LIB,
    )
    expect(counted(p, 'prs').filter((s) => s.startsWith('prs-double'))).toEqual([
      'prs-double 2026-05-04 rows-80 ×2 (last curl-20)',
    ])
  })

  it('stamps two workouts on one day, once per day', () => {
    const p = passport(
      [
        ride('morning', '2026-09-01', [[50, 10]]),
        ride('evening', '2026-09-01', [[50, 10]]),
        ride('third', '2026-09-01', [[50, 10]]), // a third that day: still one double decker
        ride('alone', '2026-09-02', [[50, 10]]),
        ride('am', '2026-09-08', [[50, 10]]),
        ride('pm', '2026-09-08', [[50, 10]]),
      ],
      LINE,
      LIB,
    )
    expect(counted(p, 'express').filter((s) => s.startsWith('express-double-decker'))).toEqual([
      'express-double-decker 2026-09-01 evening ×2 (last pm)',
    ])
  })

  it('stamps a routine workout that went off the plan', () => {
    const back = (id: string, day: string, exercises: string[]) =>
      workout(
        { id, performed_on: day, routine_day_id: 'back' },
        exercises.map((e, i) => [e, [set(`${id}-${i}`, `${id}-we${i}`, 1, 50, 10)]]),
      )
    const p = passport(
      [
        back('as-planned', '2026-09-01', ['Rows']),
        back('plus-curls', '2026-09-03', ['Rows', 'Curl']), // Curl isn't on the back day
        ride('no-routine', '2026-09-05', [[20, 10]], 'Squat'), // not a routine workout
      ],
      LINE,
      LIB,
      undefined,
      {
        routine: {
          days: [{ id: 'back', name: 'Back', exercises: [{ exercise_id: 'Rows', sets: 3 }] }],
        },
      },
    )
    expect(counted(p, 'features').filter((s) => s.startsWith('features-side'))).toEqual([
      'features-side-tracked 2026-09-03 plus-curls ×1 (last plus-curls)',
    ])
  })

  it('knows when Easter is', () => {
    expect([2024, 2025, 2026, 2027].map(easterSunday)).toEqual(['03-31', '04-20', '04-05', '03-28'])
  })

  it('stamps the less-known features', () => {
    const own = workout({ id: 'own', performed_on: '2026-09-02' }, [
      ['custom-sled', [set('o', 'owe', 1, 80, 10)]],
    ])
    const p = passport(
      [
        ride('dumbbells', '2026-09-01', [[20, 10]], 'Curl'),
        own,
        ride('prefs', '2026-09-03', [[50, 10]]),
        workout({ id: 'routine', performed_on: '2026-09-05', routine_day_id: 'd1' }, [
          ['Squat', [set('r', 'rwe', 1, 60, 8)]],
        ]),
      ],
      { ...LINE, depot: new Set(['2026-09-14', '2026-12-28']) }, // the second is still to come
      LIB,
      (id) => (id === 'Curl' ? 2 : 1), // Curl logged as two dumbbells, "each"
      { preferences: new Set(['Rows']), lastBackupAt: '2026-09-20T10:00:00Z' },
    )
    expect(counted(p, 'features')).toEqual([
      'features-routine 2026-09-05 routine ×1 (last routine)',
      'features-own 2026-09-02 own ×1 (last own)',
      'features-preferences 2026-09-03 prefs ×1 (last prefs)',
      'features-dumbbells 2026-09-01 dumbbells ×1 (last dumbbells)',
      'features-depot 2026-09-14 null ×1 (last null)',
      'features-backup 2026-09-20 null ×1 (last null)',
    ])
  })
})
