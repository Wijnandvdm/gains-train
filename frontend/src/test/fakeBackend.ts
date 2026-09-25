// A stateful, in-memory stand-in for the API, shared by the workout/routine UI tests.
import type {
  ExerciseSession,
  ExerciseSummary,
  RoutineIn,
  RoutineOut,
  SetOut,
  UserOut,
  WorkoutDetail,
  WorkoutSummary,
} from '../api/schema'
import { exercise, ME, mockApi, reply } from './utils'

export const ROW = exercise(10, 'Seated Cable Rows', { primary_muscles: ['middle back'] })
export const PULLDOWN = exercise(11, 'Wide-Grip Lat Pulldown', { primary_muscles: ['lats'] })

/** Your last Day2 session, as the history endpoints would return it. */
export const LAST_DAY2: WorkoutDetail = {
  id: 'last-day2',
  name: 'Day2 · Back & Triceps',
  routine_day_id: null,
  performed_on: '2026-09-15',
  status: 'completed',
  started_at: null,
  ended_at: null,
  notes: null,
  exercises: [
    {
      id: 'we-old',
      position: 1,
      notes: null,
      exercise: ROW,
      sets: [set('old-1', 'we-old', 1, 80, 12), set('old-2', 'we-old', 2, 80, 10)],
    },
  ],
}

export function set(
  id: string,
  weId: string,
  position: number,
  weight: number | null,
  reps: number | null,
): SetOut {
  return {
    id,
    workout_exercise_id: weId,
    position,
    weight_kg: weight,
    reps,
    rpe: null,
    is_warmup: false,
    notes: null,
    completed_at: '2026-09-15T18:00:00Z',
  }
}

const summary = (w: WorkoutDetail): WorkoutSummary => ({
  id: w.id,
  name: w.name,
  routine_day_id: w.routine_day_id,
  performed_on: w.performed_on,
  status: w.status,
  started_at: w.started_at,
  ended_at: w.ended_at,
  exercise_names: w.exercises.map((we) => we.exercise.name),
  set_count: 2,
  volume_kg: 1760,
})

/** An in-memory stand-in for the workout API. `online=false` makes writes fail. */
export function fakeBackend(
  extraHandlers: Parameters<typeof mockApi>[0] = {},
  { routine = null as RoutineOut | null, setupDone = true } = {},
) {
  const state = {
    active: null as WorkoutDetail | null,
    online: true,
    writes: [] as string[],
    routine,
    me: { ...ME, setup_completed_at: setupDone ? ME.setup_completed_at : null } as UserOut,
  }
  const library: Record<number, ExerciseSummary> = { [ROW.id]: ROW, [PULLDOWN.id]: PULLDOWN }

  function write<T>(label: string, fn: () => T): T {
    if (!state.online) throw new TypeError('Failed to fetch') // what fetch does offline
    state.writes.push(label)
    return fn()
  }

  const requests = mockApi({
    ...extraHandlers,
    'GET /api/me': () => state.me,
    'PATCH /api/me': () =>
      write('setup done', () => {
        state.me = { ...state.me, setup_completed_at: new Date().toISOString() }
        return state.me
      }),
    'GET /api/routine': () => state.routine,
    'PUT /api/routine': async (_u, request) => {
      const body = (await request.json()) as RoutineIn
      return write(`save routine ${body.days.map((d) => d.name).join('/')}`, () => {
        state.routine = routineFrom(body)
        return state.routine
      })
    },
    'POST /api/routine/from-history': () =>
      write('routine from history', () => {
        state.routine = DAY2_ROUTINE
        return state.routine
      }),
    'GET /api/workouts/active': () => state.active,
    'GET /api/workouts': () => ({ items: [summary(LAST_DAY2)], total: 1, limit: 20, offset: 0 }),
    'GET /api/workouts/:id': (_u, _r, { id }) => (id === LAST_DAY2.id ? LAST_DAY2 : reply(404)),
    'GET /api/exercises/:id/history': (_u, _r, { id }): ExerciseSession[] =>
      Number(id) === ROW.id
        ? [
            {
              workout_id: LAST_DAY2.id,
              workout_name: LAST_DAY2.name,
              performed_on: '2026-09-15',
              sets: LAST_DAY2.exercises[0]!.sets,
            },
          ]
        : [],
    'GET /api/exercises': () => ({ items: [ROW, PULLDOWN], total: 2, limit: 30, offset: 0 }),
    'POST /api/workouts': async (_u, request) => {
      const body = (await request.json()) as {
        id: string
        name: string
        performed_on: string
        routine_day_id: string | null
      }
      return write(body.routine_day_id ? `start ${body.name}` : 'start', () => {
        state.active = {
          ...body,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          ended_at: null,
          notes: null,
          exercises: [],
        }
        return state.active
      })
    },
    'POST /api/workouts/:id/exercises': async (_u, request) => {
      const body = (await request.json()) as { id: string; exercise_id: number }
      return write(`add ${library[body.exercise_id]!.name}`, () => {
        const exercises = state.active!.exercises
        exercises.push({
          id: body.id,
          position: exercises.length + 1,
          notes: null,
          exercise: library[body.exercise_id]!,
          sets: [],
        })
        return state.active
      })
    },
    'PUT /api/sets/:id': async (_u, request, { id }) => {
      const body = (await request.json()) as Omit<SetOut, 'id'>
      return write(`set ${body.weight_kg}×${body.reps}${body.completed_at ? ' ✓' : ''}`, () => {
        const we = state.active!.exercises.find((e) => e.id === body.workout_exercise_id)!
        we.sets = [...we.sets.filter((s) => s.id !== id), { id: id!, ...body }]
        return { id, ...body }
      })
    },
    'POST /api/workouts/:id/finish': () =>
      write('finish', () => {
        const finished = { ...state.active!, status: 'completed' as const }
        state.active = null
        return finished
      }),
  })
  return { state, requests }
}

/** A one-day routine: Seated Cable Rows (3 sets) then Wide-Grip Lat Pulldown (1 set). */
export const DAY2_ROUTINE: RoutineOut = {
  id: 'routine',
  next_day_id: 'day2',
  days: [
    {
      id: 'day2',
      position: 1,
      name: 'Day2 · Back & Triceps',
      exercises: [
        { exercise: ROW, sets: 3 },
        { exercise: PULLDOWN, sets: 1 },
      ],
    },
  ],
}

function routineFrom(body: RoutineIn): RoutineOut {
  const library = [ROW, PULLDOWN]
  return {
    id: 'routine',
    next_day_id: 'day-1',
    days: body.days.map((d, i) => ({
      id: d.id ?? `day-${i + 1}`,
      position: i + 1,
      name: d.name,
      exercises: (d.exercises ?? []).map((e) => ({
        exercise: library.find((x) => x.id === e.exercise_id)!,
        sets: e.sets ?? 3,
      })),
    })),
  }
}
