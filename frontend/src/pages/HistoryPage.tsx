import { Link } from 'react-router-dom'
import type { WorkoutSummary } from '../api/schema'
import { Spinner } from '../components/Spinner'
import { formatDay, formatVolume } from '../lib/format'
import { useWorkoutHistory } from '../workout/hooks'

export function HistoryPage() {
  const history = useWorkoutHistory()
  const workouts = history.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">History</h1>
      {history.isPending ? (
        <Spinner />
      ) : history.isError ? (
        <div className="py-8 text-center">
          <p className="mb-3">Couldn't load your history.</p>
          <button className="btn" onClick={() => history.refetch()}>
            Try again
          </button>
        </div>
      ) : workouts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="mb-3 text-neutral-500">No rides yet. The platform is waiting.</p>
          <Link to="/workout" className="btn btn-primary">
            Start your first ride
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <WorkoutCard workout={workout} />
            </li>
          ))}
        </ul>
      )}
      {history.hasNextPage && (
        <button
          className="btn mx-auto"
          onClick={() => history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
        >
          {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}

function WorkoutCard({ workout }: { workout: WorkoutSummary }) {
  const inProgress = workout.status === 'in_progress'
  return (
    <Link
      to={inProgress ? '/workout' : `/history/${workout.id}`}
      className="card flex flex-col gap-1 p-3 transition hover:border-brand-500"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{workout.name ?? 'Workout'}</span>
        <span className="shrink-0 text-sm text-neutral-500">{formatDay(workout.performed_on)}</span>
      </span>
      <span className="truncate text-sm text-neutral-500">
        {workout.exercise_names.join(' · ') || 'No exercises'}
      </span>
      <span className="flex gap-3 text-sm">
        {inProgress ? (
          <span className="font-medium text-brand-600 dark:text-brand-500">In progress</span>
        ) : (
          <>
            <span>
              {workout.set_count} set{workout.set_count === 1 ? '' : 's'}
            </span>
            <span className="text-neutral-500">{formatVolume(workout.volume_kg)}</span>
          </>
        )}
      </span>
    </Link>
  )
}
