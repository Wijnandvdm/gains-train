import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { WorkoutDetail, WorkoutSet } from '../data/types'
import { newSet } from '../data/workouts'
import { ExerciseThumb } from '../components/ExerciseImage'
import { BackIcon } from '../components/icons'
import { Spinner } from '../components/Spinner'
import { formatDay, formatSet, parseReps, parseWeight, weightInputText } from '../lib/format'
import { useAction } from '../lib/useAction'
import { deleteWorkout, editSets, useWorkout } from '../workout/hooks'
import { setLabels } from '../workout/sets'
import { ErrorMessage } from '../components/ErrorMessage'

/** A finished workout: to look back on, and to correct afterwards (Edit). */
export function WorkoutDetailPage() {
  const id = useParams().workoutId!
  const { data: workout, isPending } = useWorkout(id)
  const navigate = useNavigate()
  const cameFromApp = useLocation().key !== 'default'

  return (
    <section className="flex flex-col gap-4">
      <Link
        // Back to exactly where you came from (the calendar day); the href is for when
        // this page was opened directly.
        onClick={(e) => {
          if (cameFromApp) {
            e.preventDefault()
            navigate(-1)
          }
        }}
        to={
          workout
            ? `/history?month=${workout.performed_on.slice(0, 7)}&day=${workout.performed_on}`
            : '/history'
        }
        className="back-link"
      >
        <BackIcon />
        History
      </Link>
      {isPending ? (
        <Spinner />
      ) : !workout ? (
        <p className="py-8 text-center">This workout doesn't exist (anymore).</p>
      ) : (
        <Workout workout={workout} />
      )}
    </section>
  )
}

function Workout({ workout }: { workout: WorkoutDetail }) {
  const navigate = useNavigate()
  const remove = useAction(deleteWorkout)
  const [editing, setEditing] = useState(false)

  function onDelete() {
    if (!window.confirm('Delete this workout? This can’t be undone.')) return
    remove.run(workout.id).then(
      () => navigate('/history', { replace: true }),
      () => {},
    )
  }

  return (
    <article className="flex flex-col gap-4">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{workout.name ?? 'Workout'}</h1>
          {!editing && workout.status === 'completed' && (
            <button type="button" className="btn py-1" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
        <p className="text-neutral-500">{formatDay(workout.performed_on)}</p>
        {workout.notes && (
          <p className="mt-2 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
            {workout.notes}
          </p>
        )}
      </header>

      {editing ? (
        <EditSets workout={workout} onDone={() => setEditing(false)} />
      ) : (
        <>
          {workout.exercises.map((we) => {
            const labels = setLabels(we.sets)
            return (
              <section
                key={we.id}
                className="card flex flex-col gap-2 p-3"
                aria-label={we.exercise.name}
              >
                <Link to={`/exercises/${we.exercise.id}`} className="flex items-center gap-3">
                  <ExerciseThumb name={we.exercise.name} src={we.exercise.image_urls[0]} />
                  <span className="font-semibold">{we.exercise.name}</span>
                </Link>
                <ol className="flex flex-col gap-1">
                  {we.sets.map((set, i) => (
                    <li key={set.id} className="flex items-baseline gap-3 text-sm">
                      <span
                        className={`w-6 text-center font-semibold ${set.is_warmup ? 'text-ticket-900 dark:text-ticket-400' : 'text-neutral-500'}`}
                      >
                        {labels[i]}
                      </span>
                      <span className="tabular-nums">{formatSet(set.weight_kg, set.reps)}</span>
                      {set.notes && <span className="text-neutral-500 italic">{set.notes}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}

          <button
            type="button"
            className="btn mx-auto text-error-600 dark:text-error-400"
            onClick={onDelete}
            disabled={remove.isPending}
          >
            Delete workout
          </button>
          <ErrorMessage error={remove.error} prefix="Couldn't delete:" className="text-center" />
        </>
      )}
    </article>
  )
}

type Draft = { set: WorkoutSet; weight: string; reps: string }

const input =
  'w-full rounded-md border border-transparent bg-neutral-100 px-1 py-1.5 text-center tabular-nums outline-none focus:border-train-500 dark:bg-neutral-800'

/** Weight and reps as typed; a set is valid with a weight (0 for bodyweight) and 1 rep or more. */
const isValid = (d: Draft) => parseWeight(d.weight) !== null && (parseReps(d.reps) ?? 0) >= 1

/**
 * Correcting a workout afterwards: change the numbers, remove sets you didn't do, add ones you
 * forgot. Nothing is written until Save, then all at once (records and stamps follow).
 */
function EditSets({ workout, onDone }: { workout: WorkoutDetail; onDone: () => void }) {
  const [drafts, setDrafts] = useState(
    () =>
      new Map(
        workout.exercises.map((we) => [
          we.id,
          we.sets.map((set): Draft => ({
            set,
            weight: weightInputText(set.weight_kg),
            reps: set.reps === null ? '' : String(set.reps),
          })),
        ]),
      ),
  )
  const save = useAction(editSets)
  const rows = (id: string) => drafts.get(id) ?? []
  const change = (id: string, next: Draft[]) => setDrafts((prev) => new Map(prev).set(id, next))
  const valid = [...drafts.values()].flat().every(isValid)

  function onSave() {
    const sets = new Map(
      [...drafts].map(([id, ds]) => [
        id,
        ds.map((d) => ({ ...d.set, weight_kg: parseWeight(d.weight), reps: parseReps(d.reps) })),
      ]),
    )
    save.run(workout.id, sets).then(onDone, () => {})
  }

  return (
    <>
      <p className="text-sm text-neutral-500">
        Change what you did. Every set you keep counts as done; remove the ones you didn’t do.
      </p>
      {workout.exercises.map((we) => {
        const sets = rows(we.id)
        const labels = setLabels(sets.map((d) => d.set))
        return (
          <section
            key={we.id}
            className="card flex flex-col gap-2 p-3"
            aria-label={we.exercise.name}
          >
            <span className="font-semibold">{we.exercise.name}</span>
            <ol className="flex flex-col gap-1.5">
              {sets.map((d, i) => {
                const update = (patch: Partial<Draft>) =>
                  change(
                    we.id,
                    sets.map((other, j) => (j === i ? { ...other, ...patch } : other)),
                  )
                return (
                  <li
                    key={d.set.id}
                    className="grid grid-cols-[1.5rem_1fr_auto_1fr_auto_2rem] items-center gap-1.5 text-sm"
                  >
                    <span
                      className={`text-center font-semibold ${d.set.is_warmup ? 'text-ticket-900 dark:text-ticket-400' : 'text-neutral-500'}`}
                    >
                      {labels[i]}
                    </span>
                    <input
                      aria-label={`Set ${labels[i]} weight (kg)`}
                      aria-invalid={parseWeight(d.weight) === null}
                      inputMode="decimal"
                      value={d.weight}
                      onChange={(e) => update({ weight: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className={`${input} ${parseWeight(d.weight) === null ? 'border-error-500!' : ''}`}
                    />
                    <span className="text-neutral-500">kg ×</span>
                    <input
                      aria-label={`Set ${labels[i]} reps`}
                      aria-invalid={(parseReps(d.reps) ?? 0) < 1}
                      inputMode="numeric"
                      value={d.reps}
                      onChange={(e) => update({ reps: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className={`${input} ${(parseReps(d.reps) ?? 0) < 1 ? 'border-error-500!' : ''}`}
                    />
                    <span className="text-neutral-500">reps</span>
                    <button
                      type="button"
                      aria-label={`Remove set ${labels[i]}`}
                      className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() =>
                        change(
                          we.id,
                          sets.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ol>
            <button
              type="button"
              className="self-start text-sm font-medium text-train-700 dark:text-train-500"
              onClick={() => {
                // A forgotten set is usually like the one before it.
                const last = sets.at(-1)
                change(we.id, [
                  ...sets,
                  {
                    set: newSet(we.id, sets.length + 1),
                    weight: last?.weight ?? '',
                    reps: last?.reps ?? '',
                  },
                ])
              }}
            >
              + Add set
            </button>
          </section>
        )
      })}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={onDone} disabled={save.isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1"
          onClick={onSave}
          disabled={!valid || save.isPending}
        >
          Save changes
        </button>
      </div>
      {!valid && (
        <p className="text-center text-sm text-neutral-500">
          Every set needs a weight (0 for bodyweight) and at least 1 rep.
        </p>
      )}
      <ErrorMessage error={save.error} prefix="Couldn't save:" className="text-center" />
    </>
  )
}
