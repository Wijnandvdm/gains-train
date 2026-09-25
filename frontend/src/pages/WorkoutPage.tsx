import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkoutDetail, WorkoutSummary } from '../api/schema'
import { ExerciseBlock } from '../components/workout/ExerciseBlock'
import { ExercisePicker } from '../components/workout/ExercisePicker'
import { RestTimerBar } from '../components/workout/RestTimerBar'
import { SyncError, SyncStatus } from '../components/workout/SyncStatus'
import { Spinner } from '../components/Spinner'
import { formatDay } from '../lib/format'
import { useActiveWorkout, useWorkoutActions, useWorkoutHistory } from '../workout/hooks'
import { useRestTimer } from '../workout/restTimer'

export function WorkoutPage() {
  const { data: active, isPending, isError, refetch } = useActiveWorkout()
  const [justFinished, setJustFinished] = useState(false)

  if (isPending) return <Spinner />
  if (isError && active === undefined) {
    return (
      <div className="py-8 text-center">
        <p className="mb-3">Couldn't load your workout. Are you online?</p>
        <button className="btn" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    )
  }
  if (!active) return <StartWorkout justFinished={justFinished} />
  return <ActiveWorkout workout={active} onFinished={() => setJustFinished(true)} />
}

// --- Starting -----------------------------------------------------------------------------

/** The most recent workout for each distinct name, e.g. your Day1 / Day2 / Day3 split. */
function recentRoutines(workouts: WorkoutSummary[], max = 4): WorkoutSummary[] {
  const seen = new Set<string>()
  return workouts
    .filter((w) => {
      if (!w.name || w.status !== 'completed' || seen.has(w.name)) return false
      seen.add(w.name)
      return true
    })
    .slice(0, max)
}

function StartWorkout({ justFinished }: { justFinished: boolean }) {
  const actions = useWorkoutActions()
  const history = useWorkoutHistory()
  const routines = recentRoutines(history.data?.pages.flatMap((p) => p.items) ?? [])
  const [starting, setStarting] = useState(false)

  async function start(options: { name?: string; copyFrom?: string } = {}) {
    setStarting(true)
    try {
      await actions.start(options)
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {justFinished && (
        <p
          role="status"
          className="rounded-lg bg-brand-50 px-4 py-3 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
        >
          Workout finished. Nice work! See it in{' '}
          <Link to="/history" className="font-semibold underline">
            History
          </Link>
          .
        </p>
      )}

      <div>
        <h1 className="mb-1 text-2xl font-bold">Workout</h1>
        <p className="text-neutral-500">Start fresh, or repeat a recent session.</p>
      </div>

      <button
        type="button"
        className="btn btn-primary py-3 text-base"
        onClick={() => start()}
        disabled={starting}
      >
        Start empty workout
      </button>

      {routines.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Repeat a recent workout</h2>
          <ul className="flex flex-col gap-2">
            {routines.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => start({ name: w.name!, copyFrom: w.id })}
                  className="card flex w-full flex-col gap-0.5 p-3 text-left transition hover:border-brand-500"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{w.name}</span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      last {formatDay(w.performed_on)}
                    </span>
                  </span>
                  <span className="truncate text-sm text-neutral-500">
                    {w.exercise_names.join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// --- In progress --------------------------------------------------------------------------

function useElapsedMinutes(startedAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  if (!startedAt) return null
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000))
}

function ActiveWorkout({
  workout,
  onFinished,
}: {
  workout: WorkoutDetail
  onFinished: () => void
}) {
  const actions = useWorkoutActions()
  const restTimer = useRestTimer()
  const [picking, setPicking] = useState(false)
  const minutes = useElapsedMinutes(workout.started_at)

  const allSets = workout.exercises.flatMap((we) => we.sets)
  const doneSets = allSets.filter((s) => s.completed_at).length

  function finish() {
    const open = allSets.length - doneSets
    const message =
      doneSets === 0
        ? 'No sets are ticked off yet. Finish anyway?'
        : open > 0
          ? `Finish workout? ${open} set${open === 1 ? " isn't" : "s aren't"} ticked off and won't count.`
          : 'Finish workout?'
    if (!window.confirm(message)) return
    restTimer.stop()
    actions.finish(workout.id)
    onFinished()
  }

  function discard() {
    if (!window.confirm('Discard this workout? Its sets will be deleted.')) return
    restTimer.stop()
    actions.discard(workout.id)
  }

  return (
    <section className="flex flex-col gap-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{workout.name ?? 'Workout'}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-neutral-500">
            {minutes !== null && <span>{minutes} min</span>}
            <span>
              {doneSets} set{doneSets === 1 ? '' : 's'} done
            </span>
            <SyncStatus />
          </p>
        </div>
        <button type="button" className="btn btn-primary shrink-0" onClick={finish}>
          Finish
        </button>
      </header>

      <SyncError />

      {workout.exercises.length === 0 && (
        <p className="py-4 text-center text-neutral-500">Add your first exercise to get going.</p>
      )}
      {workout.exercises.map((we) => (
        <ExerciseBlock
          key={we.id}
          workoutId={workout.id}
          workoutExercise={we}
          onSetCompleted={restTimer.start}
        />
      ))}

      <button type="button" className="btn py-3" onClick={() => setPicking(true)}>
        + Add exercise
      </button>
      <button
        type="button"
        className="mx-auto text-sm text-neutral-500 hover:text-red-600"
        onClick={discard}
      >
        Discard workout
      </button>

      <RestTimerBar timer={restTimer} />
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            actions.addExercise(workout.id, exercise)
            setPicking(false)
          }}
        />
      )}
    </section>
  )
}
