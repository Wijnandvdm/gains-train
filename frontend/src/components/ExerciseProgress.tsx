import { lazy, Suspense } from 'react'
import type { ExerciseStats } from '../api/schema'
import {
  formatDay,
  formatE1rm,
  formatSet,
  formatShortDay,
  formatVolume,
  formatWeight,
} from '../lib/format'
import { useExerciseStats } from '../stats'
import { Spinner } from './Spinner'

const ProgressChart = lazy(() => import('./ProgressChart'))

/** "Your progress" on an exercise page: records, a chart, and rep records. */
export function ExerciseProgress({ exerciseId }: { exerciseId: number }) {
  const { data, isPending, isError } = useExerciseStats(exerciseId)

  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-3">
      <h2 id="progress-heading" className="font-semibold">
        Your progress
      </h2>
      {isPending ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm text-neutral-500">Couldn't load your progress.</p>
      ) : !data.records ? (
        <p className="text-sm text-neutral-500">
          You haven't logged this exercise yet. Your records and chart will show up here.
        </p>
      ) : (
        <Progress stats={data} />
      )}
    </section>
  )
}

function Progress({ stats }: { stats: ExerciseStats }) {
  const records = stats.records!
  return (
    <>
      <dl className="grid grid-cols-3 gap-2">
        <StatTile
          label="Heaviest"
          value={formatWeight(records.heaviest.weight_kg)}
          detail={`× ${records.heaviest.reps} · ${formatShortDay(records.heaviest.performed_on)}`}
        />
        <StatTile
          label="Best e1RM"
          value={formatE1rm(records.best_e1rm_kg)}
          detail={formatSet(records.best_e1rm.weight_kg, records.best_e1rm.reps)}
        />
        <StatTile
          label="Best session"
          value={formatVolume(records.best_session_volume_kg)}
          detail={formatShortDay(records.best_session_volume_on)}
        />
      </dl>

      {stats.sessions.length >= 2 ? (
        <Suspense fallback={<Spinner />}>
          <ProgressChart sessions={stats.sessions} />
        </Suspense>
      ) : (
        <p className="text-sm text-neutral-500">Log another session to see a trend.</p>
      )}

      <div className="card overflow-hidden">
        <h3 className="px-3 pt-3 text-sm font-semibold">Rep records</h3>
        <p className="px-3 text-xs text-neutral-500">
          Most reps at each weight. Beat one to set a PR.
        </p>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="px-3 py-1 font-medium">Weight</th>
              <th className="px-3 py-1 font-medium">Reps</th>
              <th className="px-3 py-1 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {records.rep_records.map((r) => (
              <tr key={r.weight_kg} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-1.5">{formatWeight(r.weight_kg)}</td>
                <td className="px-3 py-1.5">{r.reps}</td>
                <td className="px-3 py-1.5 text-right text-neutral-500">
                  {formatDay(r.performed_on)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card flex min-w-0 flex-col p-2.5">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="truncate text-lg font-semibold">{value}</dd>
      <dd className="truncate text-xs text-neutral-500">{detail}</dd>
    </div>
  )
}
