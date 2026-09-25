import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetOut, WorkoutDetail } from '../api/schema'
import { exercise } from '../test/utils'
import { applyOps, type Op } from './ops'
import { Outbox, type SendResult } from './outbox'

const W = 'workout-1'
const WE = 'we-1'

function set(id: string, overrides: Partial<SetOut> = {}): SetOut {
  return {
    id,
    workout_exercise_id: WE,
    position: 1,
    weight_kg: 60,
    reps: 8,
    rpe: null,
    is_warmup: false,
    notes: null,
    completed_at: null,
    ...overrides,
  }
}

let n = 0
const key = () => `op-${++n}`
const start = (): Op => ({
  type: 'startWorkout',
  key: key(),
  workoutId: W,
  workout: {
    name: 'Legs',
    performed_on: '2026-09-25',
    started_at: '2026-09-25T18:00:00Z',
    routine_day_id: null,
  },
})
const addExercise = (id = WE): Op => ({
  type: 'addExercise',
  key: key(),
  workoutId: W,
  workoutExerciseId: id,
  exercise: exercise(1, 'Seated Leg Curl'),
})
const putSet = (s: SetOut): Op => ({ type: 'putSet', key: key(), workoutId: W, set: s })

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

/** A fake server: records ops, answers with scripted results (default 'ok'). */
function fakeServer(results: SendResult[] = []) {
  const sent: Op[] = []
  const send = vi.fn(async (op: Op) => {
    sent.push(op)
    return results.shift() ?? 'ok'
  })
  return { sent, send }
}

/** A server that holds each request until finishAll(), like a slow gym connection. */
function slowServer() {
  const sent: Op[] = []
  const waiting: Array<() => void> = []
  const send = vi.fn((op: Op) => {
    sent.push(op)
    return new Promise<SendResult>((resolve) => waiting.push(() => resolve('ok')))
  })
  async function finishAll() {
    while (waiting.length > 0) {
      waiting.shift()!()
      await vi.advanceTimersByTimeAsync(0)
    }
  }
  return { sent, send, finishAll }
}

describe('applyOps', () => {
  it('builds up the active workout from ops', () => {
    const workout = applyOps(null, [
      start(),
      addExercise(),
      putSet(set('s2', { position: 2 })),
      putSet(set('s1', { position: 1 })),
      putSet(set('s2', { position: 2, reps: 6 })),
    ])!
    expect(workout.name).toBe('Legs')
    expect(workout.status).toBe('in_progress')
    const sets = workout.exercises[0]!.sets
    expect(sets.map((s) => [s.id, s.reps])).toEqual([
      ['s1', 8],
      ['s2', 6],
    ])
  })

  it('ignores ops for other workouts and ends on finish', () => {
    const workout = applyOps(null, [start(), addExercise()])!
    const other: Op = { ...addExercise('we-2'), workoutId: 'other' }
    expect(applyOps(workout, [other])).toBe(workout)
    const finish: Op = { type: 'finishWorkout', key: key(), workoutId: W, endedAt: 'x' }
    expect(applyOps(workout, [finish])).toBeNull()
  })

  it('renumbers exercises when one is removed', () => {
    const workout = applyOps(null, [start(), addExercise('a'), addExercise('b'), addExercise('c')])
    const after = applyOps(workout, [
      { type: 'removeExercise', key: key(), workoutId: W, workoutExerciseId: 'a' },
    ]) as WorkoutDetail
    expect(after.exercises.map((we) => [we.id, we.position])).toEqual([
      ['b', 1],
      ['c', 2],
    ])
  })
})

describe('Outbox', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sends ops in order and reports when drained', async () => {
    const server = fakeServer()
    const outbox = new Outbox(server.send, memoryStorage())
    const drained = vi.fn()
    outbox.onDrained(drained)

    outbox.enqueue(start())
    outbox.enqueue(addExercise())
    await vi.runAllTimersAsync()

    expect(server.sent.map((op) => op.type)).toEqual(['startWorkout', 'addExercise'])
    expect(outbox.getStatus()).toEqual({ pending: 0, state: 'idle', error: null })
    expect(drained).toHaveBeenCalled()
  })

  it('keeps ops and retries with backoff while offline', async () => {
    const server = fakeServer(['retry', 'retry'])
    const outbox = new Outbox(server.send, memoryStorage())

    outbox.enqueue(start())
    await vi.advanceTimersByTimeAsync(0)
    expect(outbox.getStatus()).toMatchObject({ pending: 1, state: 'offline' })

    await vi.advanceTimersByTimeAsync(1_000) // first retry: still offline
    expect(server.send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2_999) // backoff grows to 3s
    expect(server.send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(server.send).toHaveBeenCalledTimes(3)
    expect(outbox.getStatus()).toMatchObject({ pending: 0, state: 'idle' })
  })

  it('drops ops the server rejects, reports them, and carries on', async () => {
    const server = fakeServer([{ dropped: "A change couldn't be saved: nope" }])
    const outbox = new Outbox(server.send, memoryStorage())

    outbox.enqueue(putSet(set('bad')))
    outbox.enqueue(putSet(set('good')))
    await vi.runAllTimersAsync()

    expect(server.sent).toHaveLength(2)
    expect(outbox.getStatus()).toEqual({
      pending: 0,
      state: 'idle',
      error: "A change couldn't be saved: nope",
    })
  })

  it('pauses when signed out and resumes on the next flush', async () => {
    const server = fakeServer(['unauthorized'])
    const outbox = new Outbox(server.send, memoryStorage())

    outbox.enqueue(start())
    await vi.runAllTimersAsync()
    expect(outbox.getStatus()).toMatchObject({ pending: 1, state: 'paused' })

    await outbox.flush()
    expect(outbox.getStatus()).toMatchObject({ pending: 0, state: 'idle' })
  })

  it('survives a reload', async () => {
    const storage = memoryStorage()
    const offline = new Outbox(fakeServer(['retry']).send, storage)
    offline.enqueue(start())
    offline.enqueue(addExercise())
    await vi.advanceTimersByTimeAsync(0)

    const server = fakeServer()
    const reloaded = new Outbox(server.send, storage)
    expect(reloaded.getStatus().pending).toBe(2)
    await reloaded.flush()
    expect(server.sent.map((op) => op.type)).toEqual(['startWorkout', 'addExercise'])
  })

  it('only sends the latest version of a set', async () => {
    const server = slowServer()
    const outbox = new Outbox(server.send, memoryStorage())
    outbox.enqueue(putSet(set('other'))) // slow request in flight…
    outbox.enqueue(putSet(set('s1', { reps: 1 }))) // …while edits pile up behind it
    outbox.enqueue(putSet(set('s1', { reps: 2 })))
    outbox.enqueue(putSet(set('s1', { reps: 3 })))
    expect(outbox.getStatus().pending).toBe(2)

    await server.finishAll()
    const sent = server.sent.map((op) => (op.type === 'putSet' ? [op.set.id, op.set.reps] : null))
    expect(sent).toEqual([
      ['other', 8],
      ['s1', 3],
    ])
  })

  it('cancels unsent work when an exercise or workout is removed before syncing', async () => {
    const server = slowServer()
    const outbox = new Outbox(server.send, memoryStorage())
    outbox.enqueue({ ...start(), workoutId: 'earlier-workout' }) // in flight

    outbox.enqueue(start())
    outbox.enqueue(addExercise())
    outbox.enqueue(putSet(set('s1')))
    outbox.enqueue({ type: 'removeExercise', key: key(), workoutId: W, workoutExerciseId: WE })
    // The exercise never reached the server, so nothing about it needs sending.
    expect(outbox.pendingOps().map((op) => [op.type, op.workoutId])).toEqual([
      ['startWorkout', 'earlier-workout'],
      ['startWorkout', W],
    ])

    outbox.enqueue({ type: 'discardWorkout', key: key(), workoutId: W })
    expect(outbox.pendingOps().map((op) => op.workoutId)).toEqual(['earlier-workout'])
  })

  it('never cancels the op that is already on its way', async () => {
    const server = slowServer()
    const outbox = new Outbox(server.send, memoryStorage())
    outbox.enqueue(putSet(set('s1', { reps: 1 }))) // in flight: may already have arrived
    outbox.enqueue(putSet(set('s1', { reps: 2 })))

    expect(outbox.getStatus().pending).toBe(2)
    await server.finishAll()
    expect(server.send).toHaveBeenCalledTimes(2)
  })
})
