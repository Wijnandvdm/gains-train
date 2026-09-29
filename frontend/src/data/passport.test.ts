import { describe, expect, it } from 'vitest'
import { set, workout } from '../test/device'
import { passport } from './passport'

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
      'prs-1 2026-09-08 b',
      'streak-4 2026-09-22 d', // a ride every week, target 1
    ])
    expect(p.progress).toEqual({ rides: 4, weight: 43, prs: 2, streak: 4, explorer: 1 })
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
    expect(p.stamps).toHaveLength(27)
    expect(earned(p)).toEqual([])
  })
})
