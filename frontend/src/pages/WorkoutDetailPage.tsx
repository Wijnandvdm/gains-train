import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { WorkoutDetail } from '../data/types'
import { ExerciseThumb } from '../components/ExerciseImage'
import { BackIcon } from '../components/icons'
import { Spinner } from '../components/Spinner'
import { formatDay, formatSet } from '../lib/format'
import { useAction } from '../lib/useAction'
import { deleteWorkout, useWorkout } from '../workout/hooks'
import { setLabels } from '../workout/sets'
import { ErrorMessage } from '../components/ErrorMessage'

/** A finished workout, read-only. */
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
        <h1 className="text-2xl font-bold">{workout.name ?? 'Workout'}</h1>
        <p className="text-neutral-500">{formatDay(workout.performed_on)}</p>
        {workout.notes && (
          <p className="mt-2 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
            {workout.notes}
          </p>
        )}
      </header>

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
                    className={`w-6 text-center font-semibold ${set.is_warmup ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500'}`}
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
        className="btn mx-auto text-red-600"
        onClick={onDelete}
        disabled={remove.isPending}
      >
        Delete workout
      </button>
      <ErrorMessage error={remove.error} prefix="Couldn't delete:" className="text-center" />
    </article>
  )
}
