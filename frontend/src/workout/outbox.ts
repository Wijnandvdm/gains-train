/**
 * A persistent, ordered queue of workout changes waiting to reach the server.
 *
 * - Ops are sent one at a time, in order (a set can't be saved before its exercise exists).
 * - Network errors and 5xx responses are retried with backoff, and when the device comes
 *   back online. The API is idempotent, so resending an op that did arrive is harmless.
 * - Other 4xx responses can't be fixed by retrying: the op is dropped and reported.
 * - The queue survives reloads (localStorage), so sets logged offline aren't lost.
 */
import type { Op } from './ops'

export type SendResult = 'ok' | 'retry' | 'unauthorized' | { dropped: string }

export type OutboxStatus = {
  pending: number
  state: 'idle' | 'syncing' | 'offline' | 'paused'
  /** The last change the server rejected, for showing to the user. */
  error: string | null
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

const STORAGE_KEY = 'gains-train:outbox'
const RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000]

export class Outbox {
  private ops: Op[]
  private inFlight: string | null = null
  private flushing = false
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private attempt = 0
  private status: OutboxStatus
  private listeners = new Set<() => void>()
  private drainedListeners = new Set<() => void>()

  private readonly send: (op: Op) => Promise<SendResult>
  private readonly storage: KeyValueStorage | null

  constructor(send: (op: Op) => Promise<SendResult>, storage: KeyValueStorage | null) {
    this.send = send
    this.storage = storage
    this.ops = this.load()
    this.status = { pending: this.ops.length, state: 'idle', error: null }
  }

  /** Current snapshot; a new object whenever anything changes (for useSyncExternalStore). */
  getStatus = (): OutboxStatus => this.status

  pendingOps(): readonly Op[] {
    return this.ops
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Called whenever the queue has fully drained (the server is up to date). */
  onDrained(listener: () => void): () => void {
    this.drainedListeners.add(listener)
    return () => this.drainedListeners.delete(listener)
  }

  enqueue(op: Op): void {
    if (this.coalesce(op)) this.ops.push(op)
    this.changed({ error: null })
    void this.flush()
  }

  /** Forget everything, including retry state (for tests). */
  reset(): void {
    clearTimeout(this.retryTimer)
    this.ops = []
    this.attempt = 0
    this.changed({ state: 'idle', error: null })
  }

  /** Throw away everything not yet sent (e.g. on sign-out). */
  clear(): void {
    this.ops = this.ops.filter((op) => op.key === this.inFlight)
    this.changed({})
  }

  async flush(): Promise<void> {
    if (this.flushing) return
    clearTimeout(this.retryTimer)
    this.flushing = true
    try {
      while (this.ops.length > 0) {
        const op = this.ops[0]!
        this.inFlight = op.key
        this.changed({ state: 'syncing' })
        const result = await this.send(op)
        this.inFlight = null

        if (result === 'retry') {
          this.scheduleRetry()
          this.changed({ state: 'offline' })
          return
        }
        if (result === 'unauthorized') {
          this.changed({ state: 'paused' }) // resumes on the next flush (after signing in)
          return
        }
        this.attempt = 0
        this.ops = this.ops.filter((o) => o.key !== op.key)
        this.changed(typeof result === 'object' ? { error: result.dropped } : {})
      }
      this.changed({ state: 'idle' })
      this.drainedListeners.forEach((listener) => listener())
    } finally {
      this.inFlight = null
      this.flushing = false
    }
  }

  /**
   * Merge the new op with queued ones where possible. Returns false if the new op itself
   * is unnecessary. The in-flight op is never touched.
   */
  private coalesce(op: Op): boolean {
    const queued = (o: Op) => o.key !== this.inFlight
    switch (op.type) {
      case 'putSet':
        // Only the latest state of a set matters.
        this.remove((o) => queued(o) && o.type === 'putSet' && o.set.id === op.set.id)
        return true
      case 'deleteSet':
        this.remove((o) => queued(o) && o.type === 'putSet' && o.set.id === op.setId)
        return true
      case 'removeExercise': {
        const neverSent = this.ops.some(
          (o) =>
            queued(o) && o.type === 'addExercise' && o.workoutExerciseId === op.workoutExerciseId,
        )
        this.remove((o) => queued(o) && touchesExercise(o, op.workoutExerciseId))
        return !neverSent // the server never heard of it: nothing to remove there
      }
      case 'discardWorkout': {
        const neverSent = this.ops.some(
          (o) => queued(o) && o.type === 'startWorkout' && o.workoutId === op.workoutId,
        )
        this.remove((o) => queued(o) && o.workoutId === op.workoutId)
        return !neverSent
      }
      default:
        return true
    }
  }

  private remove(predicate: (op: Op) => boolean): void {
    this.ops = this.ops.filter((o) => !predicate(o))
  }

  private scheduleRetry(): void {
    const delay = RETRY_DELAYS_MS[Math.min(this.attempt, RETRY_DELAYS_MS.length - 1)]
    this.attempt += 1
    this.retryTimer = setTimeout(() => void this.flush(), delay)
  }

  private changed(update: Partial<OutboxStatus>): void {
    this.save()
    this.status = { ...this.status, ...update, pending: this.ops.length }
    this.listeners.forEach((listener) => listener())
  }

  private load(): Op[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Op[]) : []
    } catch {
      return [] // unavailable (private mode) or corrupt: start empty
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.ops))
    } catch {
      // Storage full or blocked: the queue still works for this session.
    }
  }
}

function touchesExercise(op: Op, workoutExerciseId: string): boolean {
  switch (op.type) {
    case 'addExercise':
    case 'removeExercise':
    case 'deleteSet':
      return op.workoutExerciseId === workoutExerciseId
    case 'putSet':
      return op.set.workout_exercise_id === workoutExerciseId
    default:
      return false
  }
}
