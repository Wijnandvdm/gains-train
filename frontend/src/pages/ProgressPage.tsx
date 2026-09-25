import { Link } from 'react-router-dom'
import type { ExerciseOverviewOut } from '../api/schema'
import { ExerciseThumb } from '../components/ExerciseImage'
import { Spinner } from '../components/Spinner'
import { formatDay, formatKg, formatVolume } from '../lib/format'
import { useStatsOverview } from '../stats'

/** Every exercise you've done: last session, best, and totals (your old Dashboard tab). */
export function ProgressPage() {
  const { data: rows, isPending, isError, refetch } = useStatsOverview()

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-neutral-500">Tap an exercise for its chart and records.</p>
      </div>
      {isPending ? (
        <Spinner />
      ) : isError ? (
        <div className="py-8 text-center">
          <p className="mb-3">Couldn't load your progress.</p>
          <button className="btn" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="mb-3 text-neutral-500">Finish a workout to see your progress here.</p>
          <Link to="/workout" className="btn btn-primary">
            Start a workout
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.exercise.id}>
              <OverviewCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function OverviewCard({ row }: { row: ExerciseOverviewOut }) {
  const { exercise } = row
  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="card flex items-center gap-3 p-2 transition hover:border-brand-500"
    >
      <ExerciseThumb name={exercise.name} src={exercise.image_urls[0]} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{exercise.name}</span>
          <span className="shrink-0 text-xs text-neutral-500">
            {formatDay(row.last_performed_on)}
          </span>
        </p>
        <dl className="flex flex-wrap gap-x-3 text-sm">
          <Figure label="Last" value={`${formatKg(row.last_top_weight_kg)} kg`} />
          <Figure label="Max" value={`${formatKg(row.max_weight_kg)} kg`} />
          <Figure label="e1RM" value={`${formatKg(Math.round(row.best_e1rm_kg * 10) / 10)} kg`} />
        </dl>
        <p className="text-xs text-neutral-500">
          {row.sets_logged} sets · {formatVolume(row.total_volume_kg)} total
        </p>
      </div>
    </Link>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
