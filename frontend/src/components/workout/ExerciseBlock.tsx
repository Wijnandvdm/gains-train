import { Link } from 'react-router-dom'
import type { ExerciseSummary, WorkoutExerciseOut } from '../../api/schema'
import { formatDay } from '../../lib/format'
import { uuid } from '../../lib/uuid'
import { useLastTime, useWorkoutActions } from '../../workout/hooks'
import { prsForSets } from '../../workout/prs'
import { matchPrevious, setLabels } from '../../workout/sets'
import { useExerciseStats } from '../../stats'
import { ExerciseThumb } from '../ExerciseImage'
import { RestPicker } from './RestPicker'
import { SetRow } from './SetRow'

type Props = {
  workoutId: string
  workoutExercise: WorkoutExerciseOut
  /** Starts the rest timer for this exercise. */
  onSetCompleted: (exercise: ExerciseSummary) => void
}

export function ExerciseBlock({ workoutId, workoutExercise, onSetCompleted }: Props) {
  const { exercise, sets } = workoutExercise
  const actions = useWorkoutActions()
  const lastTime = useLastTime(exercise.id).data
  const labels = setLabels(sets)
  const previous = matchPrevious(sets, lastTime?.sets ?? [])
  const prs = prsForSets(sets, useExerciseStats(exercise.id).data?.records ?? null)

  function addSet() {
    // Start from the row above (same weight is the common case); else leave it to the hints.
    const last = sets.at(-1)
    actions.saveSet(workoutId, {
      id: uuid(),
      workout_exercise_id: workoutExercise.id,
      position: (last?.position ?? 0) + 1,
      weight_kg: last?.weight_kg ?? null,
      reps: last?.reps ?? null,
      rpe: null,
      is_warmup: false,
      notes: null,
      completed_at: null,
    })
  }

  function remove() {
    const logged = sets.filter((s) => s.completed_at).length
    if (logged && !window.confirm(`Remove ${exercise.name} and its ${logged} logged sets?`)) return
    actions.removeExercise(workoutId, workoutExercise.id)
  }

  return (
    <section className="card flex flex-col gap-2 p-3" aria-label={exercise.name}>
      <header className="flex items-center gap-3">
        <ExerciseThumb name={exercise.name} src={exercise.image_urls[0]} />
        <div className="min-w-0 flex-1">
          <Link to={`/exercises/${exercise.id}`} className="block truncate font-semibold">
            {exercise.name}
          </Link>
          <p className="truncate text-sm text-neutral-500">
            {lastTime ? `Last time: ${formatDay(lastTime.performed_on)}` : 'First time'}
          </p>
          <RestPicker exercise={exercise} />
        </div>
        <button
          type="button"
          onClick={remove}
          className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:text-red-600"
        >
          Remove
        </button>
      </header>

      {sets.length > 0 && (
        <div>
          <div className="grid grid-cols-[2.25rem_1fr_4.5rem_3.5rem_2.5rem_1.75rem] gap-1.5 px-1 text-xs font-medium text-neutral-500 uppercase">
            <span className="text-center">Set</span>
            <span>Previous</span>
            <span className="text-center">kg</span>
            <span className="text-center">Reps</span>
            <span />
            <span />
          </div>
          <ol className="flex flex-col">
            {sets.map((set, i) => (
              <SetRow
                key={set.id}
                set={set}
                label={labels[i]!}
                previous={previous[i]}
                prs={prs[i]!}
                onSave={(next) => actions.saveSet(workoutId, next)}
                onDelete={() => actions.deleteSet(workoutId, set)}
                onCompleted={() => onSetCompleted(exercise)}
              />
            ))}
          </ol>
        </div>
      )}

      <button type="button" onClick={addSet} className="btn w-full">
        + Add set
      </button>
    </section>
  )
}
