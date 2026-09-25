import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  ExerciseSession,
  ExerciseSummary,
  SetOut,
  WorkoutDetail,
  WorkoutSummary,
} from '../api/schema'
import { formatDay } from '../lib/format'
import { exercise, ME, mockApi, renderApp, reply } from '../test/utils'

const ROW = exercise(10, 'Seated Cable Rows', { primary_muscles: ['middle back'] })
const PULLDOWN = exercise(11, 'Wide-Grip Lat Pulldown', { primary_muscles: ['lats'] })

/** Your last Day2 session, as the history endpoints would return it. */
const LAST_DAY2: WorkoutDetail = {
  id: 'last-day2',
  name: 'Day2 · Back & Triceps',
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

function set(
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
  performed_on: w.performed_on,
  status: w.status,
  started_at: w.started_at,
  ended_at: w.ended_at,
  exercise_names: w.exercises.map((we) => we.exercise.name),
  set_count: 2,
  volume_kg: 1760,
})

/** An in-memory stand-in for the workout API. `online=false` makes writes fail. */
function fakeBackend(extraHandlers: Parameters<typeof mockApi>[0] = {}) {
  const state = { active: null as WorkoutDetail | null, online: true, writes: [] as string[] }
  const library: Record<number, ExerciseSummary> = { [ROW.id]: ROW, [PULLDOWN.id]: PULLDOWN }

  function write<T>(label: string, fn: () => T): T {
    if (!state.online) throw new TypeError('Failed to fetch') // what fetch does offline
    state.writes.push(label)
    return fn()
  }

  const requests = mockApi({
    ...extraHandlers,
    'GET /api/me': () => ME,
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
      const body = (await request.json()) as { id: string; name: string; performed_on: string }
      return write('start', () => {
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

describe('live workout', () => {
  it('repeats a recent workout, logs sets from last time, rests, and finishes', async () => {
    const backend = fakeBackend()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/workout')

    // Start from the Day2 template: its exercises are added automatically.
    await user.click(await screen.findByRole('button', { name: /Day2 · Back & Triceps/ }))
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    expect(await within(block).findByText(`Last time: ${formatDay('2026-09-15')}`)).toBeVisible()

    // A new set shows last time's numbers as hints…
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    const weight = await within(block).findByLabelText('Set 1 weight (kg)')
    expect(weight).toHaveAttribute('placeholder', '80')
    expect(within(block).getByLabelText('Set 1 reps')).toHaveAttribute('placeholder', '12')

    // …and ticking the empty row logs exactly those, then starts the rest timer.
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('timer', { name: 'Rest timer' })).toHaveTextContent('1:30')

    // Second set: copies the row above; change the reps and tick.
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    const reps2 = await within(block).findByLabelText('Set 2 reps')
    await user.clear(reps2)
    await user.type(reps2, '11')
    await user.click(within(block).getByRole('button', { name: 'Set 2 done' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible())

    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(await screen.findByText(/Workout finished/)).toBeVisible()
    await waitFor(() => expect(backend.state.writes.at(-1)).toBe('finish'))

    expect(backend.state.writes).toEqual([
      'start',
      'add Seated Cable Rows',
      'set null×null', // "+ Add set" creates an empty row…
      'set 80×12 ✓', // …ticked with last time's numbers
      'set 80×12', // second row copies the first
      'set 80×11', // reps edited (saved on blur)
      'set 80×11 ✓',
      'finish',
    ])
  })

  it('keeps logging offline and syncs when the connection returns', async () => {
    const backend = fakeBackend()
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible())

    backend.state.online = false // gym Wi-Fi drops
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Wide-Grip Lat Pulldown/ }))
    const block = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '85')
    await user.type(within(block).getByLabelText('Set 1 reps'), '10')
    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))

    // Everything shows as logged, and the header says it's waiting to sync.
    expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await screen.findByText(/Offline · \d waiting/)).toBeVisible()
    expect(backend.state.writes).toEqual(['start'])

    // Leaving and coming back re-fetches the workout from the server, which doesn't have
    // the offline changes yet; they must still be shown on top.
    await user.click(screen.getByRole('link', { name: 'History' }))
    await screen.findByRole('heading', { name: 'History' })
    await user.click(screen.getByRole('link', { name: 'Workout' }))
    const again = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    expect(within(again).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    backend.state.online = true
    act(() => void window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible())
    expect(backend.state.writes).toEqual(['start', 'add Wide-Grip Lat Pulldown', 'set 85×10 ✓'])
  })

  it('asks for reps when ticking a set with nothing to go on', async () => {
    fakeBackend()
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(await screen.findByRole('button', { name: /Wide-Grip Lat Pulldown/ }))
    const block = await screen.findByRole('region', { name: 'Wide-Grip Lat Pulldown' })
    expect(within(block).getByText('First time')).toBeVisible()
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.click(await within(block).findByRole('button', { name: 'Set 1 done' }))

    expect(within(block).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(block).getByLabelText('Set 1 reps')).toHaveClass('border-red-500!')
  })
})

describe('personal records', () => {
  it('marks a set that beats your records as a PR, right when it is ticked', async () => {
    fakeBackend({
      'GET /api/stats/exercises/:id': () => ({
        records: {
          heaviest: { weight_kg: 80, reps: 12, performed_on: '2026-09-15' },
          best_e1rm: { weight_kg: 80, reps: 12, performed_on: '2026-09-15' },
          best_e1rm_kg: 112,
          best_session_volume_kg: 1760,
          best_session_volume_on: '2026-09-15',
          rep_records: [{ weight_kg: 80, reps: 12, performed_on: '2026-09-15' }],
        },
        sessions: [],
      }),
    })
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: /Day2 · Back & Triceps/ }))
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.type(await within(block).findByLabelText('Set 1 weight (kg)'), '82.5')
    // 82.5 × 12: heavier than 80 kg, and e1RM 115.5 beats 112.
    await user.type(within(block).getByLabelText('Set 1 reps'), '12')
    expect(within(block).queryByRole('img', { name: /Personal record/ })).toBeNull()

    await user.click(within(block).getByRole('button', { name: 'Set 1 done' }))
    expect(
      await within(block).findByRole('img', {
        name: 'Personal record: Heaviest weight, Best estimated 1RM',
      }),
    ).toHaveTextContent('🏆 PR')

    // Same again: it only ties the set before it, so no second badge.
    await user.click(within(block).getByRole('button', { name: '+ Add set' }))
    await user.click(await within(block).findByRole('button', { name: 'Set 2 done' }))
    expect(within(block).getAllByRole('img', { name: /Personal record/ })).toHaveLength(1)
  })
})

describe('history', () => {
  it('lists past workouts with totals', async () => {
    fakeBackend()
    renderApp('/history')
    const card = (await screen.findByText('Day2 · Back & Triceps')).closest('a')!
    expect(card).toHaveAttribute('href', '/history/last-day2')
    expect(within(card).getByText('2 sets')).toBeVisible()
    expect(within(card).getByText(/1,760 kg/)).toBeVisible()
  })

  it('shows a past workout set by set', async () => {
    fakeBackend()
    renderApp('/history/last-day2')
    const block = await screen.findByRole('region', { name: 'Seated Cable Rows' })
    expect(within(block).getByText('80 × 12')).toBeVisible()
    expect(within(block).getByText('80 × 10')).toBeVisible()
  })
})
