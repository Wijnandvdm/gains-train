import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ExerciseSummary, RoutineDay, Routine, WorkoutDetail } from '../data/types'
import { ExerciseBlock } from '../components/workout/ExerciseBlock'
import { ExercisePicker } from '../components/workout/ExercisePicker'
import { FocusCard } from '../components/workout/FocusCard'
import { RestTimerBar } from '../components/workout/RestTimerBar'
import { RoutineSuggestion, type Suggestion } from '../components/workout/RoutineSuggestion'
import { SortableExercises } from '../components/workout/SortableExercises'
import { moved, orderDiffers } from '../workout/reorder'
import { WorkoutTrack } from '../components/workout/WorkoutTrack'
import { TrainIcon } from '../components/icons'
import { Spinner } from '../components/Spinner'
import { cheer, firebox, WORKOUT } from '../copy'
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
import { BackupReminder } from '../components/BackupReminder'
import { NextStationCard } from '../components/GainsLine'
import { StampBadge } from '../components/Passport'
import { usePassport } from '../passport'
import { useExerciseRestTimer } from '../preferences'
import { useSkipped } from '../workout/skipped'

export function WorkoutPage() {
  const active = useActiveWorkout()
  const routine = useRoutine()
  const [finished, setFinished] = useState<{ id: string; day: string } | null>(null)
  // With a routine, the next day is shown ready to go; this switches to the other options.
  const [choosing, setChoosing] = useState(false)

  if (active.isPending || routine.isPending) return <Spinner />
  if (active.data) {
    return (
      <ActiveWorkout
        workout={active.data}
        routine={routine.data ?? null}
        onFinished={() => {
          setFinished({ id: active.data!.id, day: active.data!.performed_on })
          setChoosing(false)
        }}
      />
    )
  }
  const hasRoutine = Boolean(routine.data?.days.length)
  return (
    <section className="flex flex-col gap-6">
      {finished && <FinishedBanner workoutId={finished.id} day={finished.day} />}
      <NextStationCard />
      {hasRoutine && !choosing ? (
        <UpNext routine={routine.data!} onOther={() => setChoosing(true)} />
      ) : (
        <StartWorkout onBack={hasRoutine ? () => setChoosing(false) : undefined} />
      )}
    </section>
  )
}

function FinishedBanner({ workoutId, day }: { workoutId: string; day: string }) {
  const passport = usePassport()
  const stamps = passport?.stamps.filter((s) => s.earnedBy === workoutId) ?? []
  const volume = useWorkoutSummaries(day, day).data?.find((w) => w.id === workoutId)?.volume_kg
  const coal = volume === undefined ? null : firebox(volume)
  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-lg bg-done-50 px-4 pt-9 pb-3 text-done-900 dark:bg-done-900/40 dark:text-done-100"
    >
      {/* Rolls across once; stays parked on the left with reduced motion. */}
      <TrainIcon
        aria-hidden="true"
        className="absolute top-2 left-3 h-7 w-7 -scale-x-100 text-train-600 motion-safe:animate-choo dark:text-train-500"
      />
      <p>
        <strong>{WORKOUT.finished}</strong> Workout saved. See it in{' '}
        <Link to="/history" className="font-semibold underline">
          History
        </Link>
        .
      </p>
      {coal && <p className="mt-1">{coal}</p>}
      {passport?.recordWorkouts.has(workoutId) && <p className="mt-1">{WORKOUT.record}</p>}
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
      <BackupReminder />
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
  const routineDay: RoutineDay = routine.days.find((d) => d.id === dayId) ?? routine.days[0]!

  // Today's order, if you dragged the list (only until you start; per day). Keyed by
  // exercise and how many times it came before, so the keys survive reordering.
  const [reordered, setReordered] = useState<{ dayId: string; keys: string[] } | null>(null)
  // Exercises added for today (before starting); they go first unless you drag them.
  const [extra, setExtra] = useState<{ dayId: string; exercises: RoutineDay['exercises'] } | null>(
    null,
  )
  const [asked, setAsked] = useState<Suggestion | null>(null)
  const [picking, setPicking] = useState(false)
  const seen = new Map<string, number>()
  const keyed = [
    ...routineDay.exercises,
    ...(extra?.dayId === routineDay.id ? extra.exercises : []),
  ].map((re) => {
    const n = seen.get(re.exercise.id) ?? 0
    seen.set(re.exercise.id, n + 1)
    return { key: `${re.exercise.id}#${n}`, re }
  })
  const order = reordered?.dayId === routineDay.id ? reordered.keys : null
  const today = order
    ? [
        ...order.flatMap((k) => keyed.find((e) => e.key === k) ?? []),
        ...keyed.filter((e) => !order.includes(e.key)),
      ]
    : keyed
  const day: RoutineDay = { ...routineDay, exercises: today.map((e) => e.re) }
  const lastTimes = useLastTimes(day.exercises.map((re) => re.exercise.id))

  function move(key: string, toIndex: number) {
    const from = today.findIndex((e) => e.key === key)
    const keys = moved(today, from, toIndex).map((e) => e.key)
    setReordered({ dayId: routineDay.id, keys })
    const ids = keys.map((k) => keyed.find((e) => e.key === k)!.re.exercise.id)
    const dayIds = routineDay.exercises.map((re) => re.exercise.id)
    setAsked(
      orderDiffers(dayIds, ids)
        ? {
            dayId: routineDay.id,
            question: 'Do the exercises in this order from now on?',
            change: { kind: 'order', exerciseIds: ids },
          }
        : null,
    )
  }

  /** Start with another exercise: it goes to the top (or moves there, when it's in already). */
  function add(exercise: ExerciseSummary) {
    const there = today.find((e) => e.re.exercise.id === exercise.id)
    const key = there?.key ?? `${exercise.id}#0`
    if (!there) {
      const added = extra?.dayId === routineDay.id ? extra.exercises : []
      setExtra({ dayId: routineDay.id, exercises: [...added, { exercise, sets: 3 }] })
    }
    setReordered({
      dayId: routineDay.id,
      keys: [key, ...today.map((e) => e.key).filter((k) => k !== key)],
    })
    const inRoutine = routineDay.exercises.some((re) => re.exercise.id === exercise.id)
    setAsked(
      inRoutine
        ? null
        : {
            dayId: routineDay.id,
            question: `Add ${exercise.name} to ${routineDay.name} from now on?`,
            change: { kind: 'add', exerciseId: exercise.id, after: null, sets: 3 },
          },
    )
  }

  // The day as it would be, before anything is saved: nothing is created until the first ✓.
  const plan: PlannedExercise[] = today.map(({ key, re }) => ({
    key,
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
        <p className="text-sm font-medium text-train-600 dark:text-train-500">
          {dayId === routine.next_day_id ? WORKOUT.nextDay : WORKOUT.otherDay}
        </p>
        <h1 className="text-2xl font-bold">{day.name}</h1>
        {routine.days.length > 1 && (
          <div role="group" aria-label="Routine day" className="chip-row">
            {routine.days.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={d.id === day.id}
                onClick={() => {
                  setDayId(d.id)
                  setAsked(null)
                  setExtra(null)
                }}
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
        // Drag to change today's order: the set card follows the first one.
        <div
          aria-label="Today's exercises"
          className="flex flex-col gap-0.5 text-sm text-neutral-500"
        >
          <SortableExercises
            items={today.map(({ key, re }) => ({ id: key, name: re.exercise.name, re }))}
            onMove={(item, toIndex) => move(item.id, toIndex)}
          >
            {({ re }, dragHandle) => (
              <div className="flex items-center gap-2">
                {dragHandle}
                <span>
                  {re.sets} × {re.exercise.name}
                </span>
              </div>
            )}
          </SortableExercises>
        </div>
      )}
      {asked && (
        <RoutineSuggestion
          key={JSON.stringify(asked.change)} // a new order asks afresh
          suggestion={asked}
          onDone={() => setAsked(null)}
        />
      )}

      <button type="button" className="btn self-start" onClick={() => setPicking(true)}>
        + Add exercise
      </button>
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            add(exercise)
            setPicking(false)
          }}
        />
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
                  className="card flex w-full flex-col gap-0.5 p-3 text-left transition hover:border-train-500"
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

  // After you change a routine workout: make it the routine day's standard? It's asked with
  // the sets done so far: logging a set means you've moved on, so the question goes.
  const [asked, setAsked] = useState<{ suggestion: Suggestion; atSets: number } | null>(null)
  const suggestion = asked?.atSets === doneSets ? asked.suggestion : null
  const ask = (s: Suggestion) => setAsked({ suggestion: s, atSets: doneSets })
  const dayIds = routineDay?.exercises.map((re) => re.exercise.id) ?? []
  const dayHas = (exerciseId: string) => dayIds.includes(exerciseId)

  async function move(workoutExerciseId: string, toIndex: number) {
    await actions.moveExercise(workout.id, workoutExerciseId, toIndex)
    if (!routineDay) return
    const from = workout.exercises.findIndex((we) => we.id === workoutExerciseId)
    const order = moved(workout.exercises, from, toIndex).map((we) => we.exercise.id)
    if (orderDiffers(dayIds, order)) {
      ask({
        dayId: routineDay.id,
        question: 'Do the exercises in this order from now on?',
        change: { kind: 'order', exerciseIds: order },
      })
    }
  }

  async function add(exercise: ExerciseSummary) {
    await actions.addExercise(workout.id, exercise)
    if (!routineDay || dayHas(exercise.id)) return
    // It went in last: in the routine, after the last of today's exercises the day has.
    const after =
      workout.exercises
        .map((we) => we.exercise.id)
        .filter(dayHas)
        .at(-1) ?? null
    ask({
      dayId: routineDay.id,
      question: `Add ${exercise.name} to ${routineDay.name} from now on?`,
      change: { kind: 'add', exerciseId: exercise.id, after, sets: 3 },
    })
  }

  function removed(exercise: ExerciseSummary) {
    if (!routineDay || !dayHas(exercise.id)) return
    ask({
      dayId: routineDay.id,
      question: `Take ${exercise.name} out of ${routineDay.name} from now on?`,
      change: { kind: 'remove', exerciseId: exercise.id },
    })
  }

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
          className="-mt-2 text-center text-sm font-medium text-train-700 dark:text-train-500"
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
            <p className="font-semibold">{WORKOUT.planDone}</p>
            <button type="button" className="btn btn-primary w-full py-3" onClick={finish}>
              Finish workout
            </button>
          </div>
        )
      )}

      {workout.exercises.length === 0 && (
        <p className="py-4 text-center text-neutral-500">Add your first exercise to get going.</p>
      )}
      {suggestion && (
        <RoutineSuggestion
          key={suggestion.question}
          suggestion={suggestion}
          onDone={() => setAsked(null)}
        />
      )}
      <SortableExercises
        items={workout.exercises.map((we) => ({ id: we.id, name: we.exercise.name, we }))}
        onMove={(item, toIndex) => void move(item.id, toIndex)}
      >
        {({ we }, dragHandle) => (
          <ExerciseBlock
            workoutId={workout.id}
            workoutExercise={we}
            onSetCompleted={restTimer.startFor}
            onRemoved={() => removed(we.exercise)}
            dragHandle={workout.exercises.length > 1 ? dragHandle : undefined}
          />
        )}
      </SortableExercises>

      <button type="button" className="btn py-3" onClick={() => setPicking(true)}>
        + Add exercise
      </button>
      <button
        type="button"
        className="mx-auto text-sm text-neutral-500 hover:text-error-600 dark:hover:text-error-400"
        onClick={discard}
      >
        Discard workout
      </button>

      <RestTimerBar timer={restTimer} />
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            void add(exercise)
            setPicking(false)
          }}
        />
      )}
    </section>
  )
}
