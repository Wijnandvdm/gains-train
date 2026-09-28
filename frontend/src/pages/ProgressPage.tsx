import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ExerciseOverview, Routine } from '../data/types'
import { ExerciseThumb } from '../components/ExerciseImage'
import { Passport } from '../components/Passport'
import { Spinner } from '../components/Spinner'
import { formatDay, formatE1rm, formatVolume, formatWeight } from '../lib/format'
import { useRoutine } from '../routine'
import { useStatsOverview } from '../stats'

/** Every exercise you've done: last session, best, and totals (your old Dashboard tab). */
export function ProgressPage() {
  const { data: rows } = useStatsOverview()
  const { data: routine } = useRoutine()
  // The chosen day lives in the URL, so coming back from an exercise keeps it.
  const [params, setParams] = useSearchParams()
  const days = routine?.days.length ? routine : null
  const filter = days ? (params.get('day') ?? days.next_day_id ?? 'all') : 'all'
  const shown = rows && days ? forDay(rows, days, filter) : rows

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-neutral-500">
          Keeping track of your gains. Tap an exercise for its chart and records.
        </p>
      </div>
      <Passport />
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="mb-3 text-neutral-500">Finish a workout to see your progress here.</p>
          <Link to="/workout" className="btn btn-primary">
            Start a workout
          </Link>
        </div>
      ) : (
        <>
          {days && (
            <DayChips
              routine={days}
              hasOther={forDay(rows, days, 'other').length > 0}
              selected={filter}
              onSelect={(day) => setParams({ day }, { replace: true })}
            />
          )}
          {shown!.length === 0 ? (
            <p className="py-4 text-center text-neutral-500">
              None of this day's exercises are logged yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown!.map((row) => (
                <li key={row.exercise.id}>
                  <OverviewCard row={row} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/**
 * The exercises of one routine day, in the day's order; "other" is everything that isn't in
 * the routine; "all" is everything, most recently done first.
 */
function forDay(rows: ExerciseOverview[], routine: Routine, day: string): ExerciseOverview[] {
  if (day === 'other') {
    const inRoutine = new Set(routine.days.flatMap((d) => d.exercises.map((e) => e.exercise.id)))
    return rows.filter((r) => !inRoutine.has(r.exercise.id))
  }
  const routineDay = routine.days.find((d) => d.id === day)
  if (!routineDay) return rows
  const byId = new Map(rows.map((r) => [r.exercise.id, r]))
  return routineDay.exercises.flatMap((e) => {
    const row = byId.get(e.exercise.id)
    byId.delete(e.exercise.id) // an exercise listed twice in a day shows once
    return row ? [row] : []
  })
}

function DayChips({
  routine,
  hasOther,
  selected,
  onSelect,
}: {
  routine: Routine
  hasOther: boolean
  selected: string
  onSelect: (day: string) => void
}) {
  const options = [
    { id: 'all', name: 'All' },
    ...routine.days.map((d) => ({ id: d.id, name: d.name })),
    ...(hasOther ? [{ id: 'other', name: 'Other' }] : []),
  ]
  // Keep the chosen day in sight (the next day can be past the edge of the screen).
  const group = useRef<HTMLDivElement>(null)
  useEffect(() => {
    group.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  return (
    <div ref={group} role="group" aria-label="Routine day" className="chip-row">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === selected}
          onClick={() => onSelect(o.id)}
          className={`chip shrink-0 normal-case ${o.id === selected ? 'chip-active' : ''}`}
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}

function OverviewCard({ row }: { row: ExerciseOverview }) {
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
          <Figure label="Last" value={formatWeight(row.last_top_weight_kg)} />
          <Figure label="Max" value={formatWeight(row.max_weight_kg)} />
          <Figure label="e1RM" value={formatE1rm(row.best_e1rm_kg)} />
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
