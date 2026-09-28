import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RoutineDay, Routine, WorkoutDetail } from '../data/types'
import { ExerciseBlock } from '../components/workout/ExerciseBlock'
import { ExercisePicker } from '../components/workout/ExercisePicker'
import { FocusCard } from '../components/workout/FocusCard'
import { RestTimerBar } from '../components/workout/RestTimerBar'
import { WorkoutTrack } from '../components/workout/WorkoutTrack'
import { TrainIcon } from '../components/icons'
import { Spinner } from '../components/Spinner'
import { cheer } from '../copy'
import { formatDay, plural } from '../lib/format'
import { newSet } from '../data/workouts'
import { useRoutine } from '../routine'
import {
  useActiveWorkout,
  useLastTimes,
  useWorkoutActions,
  useWorkoutSummaries,
} from '../workout/hooks'
import { type NextSet, nextSet, type PlannedExercise, plannedSetCount } from '../workout/plan'
import { recentRoutines } from '../workout/recent'
import { NextStationCard } from '../components/GainsLine'
import { StampBadge } from '../components/Passport'
import { usePassport } from '../passport'
import { useExerciseRestTimer } from '../preferences'
import { useSkipped } from '../workout/skipped'

export function WorkoutPage() {
  const active = useActiveWorkout()
  const routine = useRoutine()
  const [finishedId, setFinishedId] = useState<string | null>(null)
  // With a routine, the next day is shown ready to go; this switches to the other options.
  const [choosing, setChoosing] = useState(false)

  if (active.isPending || routine.isPending) return <Spinner />
  if (active.data) {
    return (
      <ActiveWorkout
        workout={active.data}
        routine={routine.data ?? null}
        onFinished={() => {
          setFinishedId(active.data!.id)
          setChoosing(false)
        }}
      />
    )
  }
  const hasRoutine = Boolean(routine.data?.days.length)
  return (
    <section className="flex flex-col gap-6">
      {finishedId && <FinishedBanner workoutId={finishedId} />}
      <NextStationCard />
      {hasRoutine && !choosing ? (
        <UpNext routine={routine.data!} onOther={() => setChoosing(true)} />
      ) : (
        <StartWorkout onBack={hasRoutine ? () => setChoosing(false) : undefined} />
      )}
    </section>
  )
}

function FinishedBanner({ workoutId }: { workoutId: string }) {
  const stamps = usePassport()?.stamps.filter((s) => s.earnedBy === workoutId) ?? []
  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-lg bg-brand-50 px-4 pt-9 pb-3 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
    >
      {/* Rolls across once; stays parked on the left with reduced motion. */}
      <TrainIcon
        aria-hidden="true"
        className="absolute top-2 left-3 h-7 w-7 -scale-x-100 text-brand-600 motion-safe:animate-choo dark:text-brand-500"
      />
      <p>
        <strong>End of the line!</strong> Workout saved. See it in{' '}
        <Link to="/history" className="font-semibold underline">
          History
        </Link>
        .
      </p>
      {stamps.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="font-semibold">
            {stamps.length === 1
              ? 'New stamp in your passport!'
              : `${stamps.length} new stamps in your passport!`}
          </p>
          <ul className="flex flex-wrap gap-3">
            {stamps.map((stamp) => (
              <li key={stamp.id}>
                <StampBadge stamp={stamp} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** A stable key per set: remounting the focus card resets its prefilled numbers. */
const focusKey = (next: NextSet) =>
  `${next.item.key}-${next.setNumber}-${next.prefill.weight}-${next.prefill.reps}`

// --- Up next (routine) --------------------------------------------------------------------

function UpNext({ routine, onOther }: { routine: Routine; onOther: () => void }) {
  const actions = useWorkoutActions()
  const restTimer = useExerciseRestTimer()
  const [dayId, setDayId] = useState(routine.next_day_id ?? routine.days[0]!.id)
  const day: RoutineDay = routine.days.find((d) => d.id === dayId) ?? routine.days[0]!
  const lastTimes = useLastTimes(day.exercises.map((re) => re.exercise.id))

  // The day as it would be, before anything is saved: nothing is created until the first ✓.
  const plan: PlannedExercise[] = day.exercises.map((re, i) => ({
    key: `${re.exercise.id}-${i}`,
    exercise: re.exercise,
    workoutExerciseId: null,
    routineSets: re.sets,
    sets: [],
    lastTime: lastTimes.get(re.exercise.id) ?? [],
  }))
  const next = nextSet(plan, new Set())

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-brand-600 dark:text-brand-500">
          {dayId === routine.next_day_id ? 'Next stop' : 'Changing tracks'}
        </p>
        <h1 className="text-2xl font-bold">{day.name}</h1>
        {routine.days.length > 1 && (
          <div role="group" aria-label="Routine day" className="chip-row">
            {routine.days.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={d.id === day.id}
                onClick={() => setDayId(d.id)}
                className={`chip normal-case ${d.id === day.id ? 'chip-active' : ''}`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {next ? (
        <FocusCard
          key={focusKey(next)}
          next={next}
          onConfirm={(values) => {
            actions.startDay(day, values)
            // Picked up by the workout screen that replaces this one.
            restTimer.startFor(day.exercises[0]!.exercise)
          }}
        />
      ) : (
        <p className="text-neutral-500">
          This day has no exercises yet.{' '}
          <Link to="/routine" className="font-medium underline">
            Add some
          </Link>
        </p>
      )}

      {day.exercises.length > 1 && (
        <ol className="flex flex-col gap-1 text-sm text-neutral-500">
          {day.exercises.map((re, i) => (
            <li key={i}>
              {re.sets} × {re.exercise.name}
            </li>
          ))}
        </ol>
      )}

      <p className="flex gap-4 text-sm">
        <Link to="/routine" className="text-neutral-500 underline">
          Edit routine
        </Link>
        <button type="button" onClick={onOther} className="text-neutral-500 underline">
          Other workout
        </button>
      </p>
    </>
  )
}

// --- Starting without a routine -----------------------------------------------------------

function StartWorkout({ onBack }: { onBack?: () => void }) {
  const actions = useWorkoutActions()
  const { data: history = [] } = useWorkoutSummaries()
  const recent = recentRoutines(history)
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
    <>
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

      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Repeat a recent workout</h2>
          <ul className="flex flex-col gap-2">
            {recent.map((w) => (
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

      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm text-neutral-500 underline">
          Back to your routine
        </button>
      ) : (
        <Link to="/routine" className="text-center text-sm text-neutral-500 underline">
          Set up a routine
        </Link>
      )}
    </>
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
  routine,
  onFinished,
}: {
  workout: WorkoutDetail
  routine: Routine | null
  onFinished: () => void
}) {
  const actions = useWorkoutActions()
  const restTimer = useExerciseRestTimer()
  const [picking, setPicking] = useState(false)
  const [skipped, skip] = useSkipped(workout.id)
  const minutes = useElapsedMinutes(workout.started_at)
  const lastTimes = useLastTimes(workout.exercises.map((we) => we.exercise.id))

  const routineDay = routine?.days.find((d) => d.id === workout.routine_day_id)
  const plan: PlannedExercise[] = workout.exercises.map((we) => ({
    key: we.id,
    exercise: we.exercise,
    workoutExerciseId: we.id,
    routineSets: routineDay?.exercises.find((re) => re.exercise.id === we.exercise.id)?.sets,
    sets: we.sets,
    lastTime: lastTimes.get(we.exercise.id) ?? [],
  }))
  const next = nextSet(plan, skipped)

  const allSets = workout.exercises.flatMap((we) => we.sets)
  const doneSets = allSets.filter((s) => s.completed_at).length

  function confirm(target: NextSet, values: { weight_kg: number; reps: number }) {
    const completed_at = new Date().toISOString()
    const sets = target.item.sets
    actions.saveSet(
      workout.id,
      target.openSet
        ? { ...target.openSet, ...values, completed_at }
        : newSet(target.item.workoutExerciseId!, Math.max(0, ...sets.map((s) => s.position)) + 1, {
            ...values,
            completed_at,
          }),
    )
    restTimer.startFor(target.item.exercise)
  }

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
            <span>{plural(doneSets, 'set')} done</span>
          </p>
        </div>
        <button type="button" className="btn btn-primary shrink-0" onClick={finish}>
          Finish
        </button>
      </header>

      <WorkoutTrack
        stations={plan.map((item) => ({
          name: item.exercise.name,
          done: item.sets.filter((s) => s.completed_at && !s.is_warmup).length,
          planned: skipped.has(item.key)
            ? item.sets.filter((s) => s.completed_at && !s.is_warmup).length
            : plannedSetCount(item),
        }))}
      />
      {doneSets > 0 && (
        <p
          aria-live="polite"
          className="-mt-2 text-center text-sm font-medium text-brand-700 dark:text-brand-500"
        >
          {cheer(doneSets)}
        </p>
      )}

      {next ? (
        <FocusCard
          key={focusKey(next)}
          next={next}
          onConfirm={(values) => confirm(next, values)}
          onSkipExercise={() => skip(next.item.key)}
        />
      ) : (
        workout.exercises.length > 0 && (
          <div className="card flex flex-col items-center gap-3 p-4 text-center">
            <p className="font-semibold">End of the line! 🚂 That's everything you planned.</p>
            <button type="button" className="btn btn-primary w-full py-3" onClick={finish}>
              Finish workout
            </button>
          </div>
        )
      )}

      {workout.exercises.length === 0 && (
        <p className="py-4 text-center text-neutral-500">Add your first exercise to get going.</p>
      )}
      {workout.exercises.map((we) => (
        <ExerciseBlock
          key={we.id}
          workoutId={workout.id}
          workoutExercise={we}
          onSetCompleted={restTimer.startFor}
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
