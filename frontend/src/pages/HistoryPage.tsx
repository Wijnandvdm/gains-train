import { Link, useSearchParams } from 'react-router-dom'
import type { WorkoutSummary } from '../data/types'
import { LinePills, WeekMarker } from '../components/GainsLine'
import { BackIcon, DepotIcon, TicketIcon } from '../components/icons'
import { type GainsLine, nextMonday, onTheLine, previousMonday, weekOf } from '../data/line'
import { HISTORY } from '../copy'
import { useGainsLine } from '../line'
import { Spinner } from '../components/Spinner'
import {
  currentMonth,
  isValidMonth,
  type Month,
  monthGrid,
  monthLabel,
  monthOf,
  monthRange,
  shiftMonth,
  weekdayLabels,
} from '../lib/calendar'
import { formatDay, formatVolume, localDateString, parseLocalDate, plural } from '../lib/format'
import { useWorkoutSummaries } from '../workout/hooks'

export function HistoryPage() {
  // Month and selected day live in the URL, so "back" from a workout returns right here.
  const [params, setParams] = useSearchParams()
  const today = localDateString()
  const month: Month = isValidMonth(params.get('month')) ? params.get('month')! : currentMonth()
  const { from, to } = monthRange(month)

  const { data: workouts = [], isPending } = useWorkoutSummaries(from, to)
  const line = useGainsLine()

  const byDay = new Map<string, WorkoutSummary[]>()
  for (const w of [...workouts].reverse()) {
    byDay.set(w.performed_on, [...(byDay.get(w.performed_on) ?? []), w])
  }

  // Selected day: from the URL, else the latest workout this month, else today.
  const paramDay = params.get('day')
  const selected =
    paramDay && monthOf(paramDay) === month
      ? paramDay
      : (workouts[0]?.performed_on ?? (monthOf(today) === month ? today : null))

  function go(update: { month?: Month; day?: string | null }) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (update.month !== undefined) {
          next.set('month', update.month)
          next.delete('day')
        }
        if (update.day) next.set('day', update.day)
        return next
      },
      { replace: true },
    )
  }

  const finished = workouts.filter((w) => w.status === 'completed')
  const sets = finished.reduce((sum, w) => sum + w.set_count, 0)
  const volume = finished.reduce((sum, w) => sum + w.volume_kg, 0)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">History</h1>
        {month !== currentMonth() && (
          <button type="button" className="btn py-1" onClick={() => go({ month: currentMonth() })}>
            Today
          </button>
        )}
      </div>

      {line && (
        <LinePills streak={line.streak} tickets={line.tickets} nextTicketAt={line.nextTicketAt} />
      )}

      <div className="card flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Previous month"
            onClick={() => go({ month: shiftMonth(month, -1) })}
          >
            <BackIcon />
          </button>
          <h2 className="font-semibold capitalize" aria-live="polite">
            {monthLabel(month)}
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
            aria-label="Next month"
            disabled={month >= currentMonth()}
            onClick={() => go({ month: shiftMonth(month, 1) })}
          >
            <span className="block -scale-x-100">
              <BackIcon />
            </span>
          </button>
        </div>

        <CalendarGrid
          month={month}
          byDay={byDay}
          selected={selected}
          today={today}
          line={line}
          onSelect={(day) => go({ day })}
        />

        {line && finished.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span aria-hidden="true" className="flex gap-0.5">
              {Array.from({ length: Math.min(line.target, 3) }, (_, i) => (
                <RideRing key={i} rides={i + 1} target={Math.min(line.target, 3)} size={16} />
              ))}
            </span>
            Rings fill up with each ride of the week; {line.target}{' '}
            {line.target === 1 ? 'ride closes' : 'rides close'} the circle.
          </p>
        )}
        {line && line.weeks.size > 1 && (
          <ul
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500"
            aria-label="Week legend"
          >
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="block h-4 w-4 rounded-full border-[3px] border-brand-600 bg-white dark:border-brand-500 dark:bg-neutral-900"
              />
              {line.target} rides: station reached
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="grid h-4 w-4 place-items-center rounded-full tone-ticket"
              >
                <TicketIcon className="h-3 w-3" />
              </span>
              saved by a ticket
            </li>
            {[...line.weeks.values()].some((w) => w.state === 'depot') && (
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="grid h-4 w-4 place-items-center rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  <DepotIcon className="h-3 w-3" />
                </span>
                in the depot
              </li>
            )}
          </ul>
        )}
      </div>

      {isPending ? (
        <Spinner />
      ) : (
        <>
          <p className="text-sm text-neutral-500">
            {finished.length === 0
              ? 'No rides this month yet.'
              : `${finished.length} ${finished.length === 1 ? 'ride' : 'rides'} · ${sets} sets · ${formatVolume(volume)}`}
          </p>
          {selected && (
            <DayWorkouts
              day={selected}
              workouts={byDay.get(selected) ?? []}
              isFuture={selected > today}
            />
          )}
        </>
      )}
    </section>
  )
}

function CalendarGrid({
  month,
  byDay,
  selected,
  today,
  line,
  onSelect,
}: {
  month: Month
  byDay: Map<string, WorkoutSummary[]>
  selected: string | null
  today: string
  line: GainsLine | undefined
  onSelect: (day: string) => void
}) {
  const weekdays = weekdayLabels()
  return (
    <table className="w-full table-fixed border-separate border-spacing-0.5">
      <thead>
        <tr>
          {weekdays.map((d) => (
            <th
              key={d.long}
              scope="col"
              abbr={d.long}
              className="pb-1 text-xs font-medium text-neutral-500"
            >
              {d.short}
            </th>
          ))}
          <th scope="col" className="w-9 pb-1 text-xs font-medium text-neutral-500">
            Week
          </th>
        </tr>
      </thead>
      <tbody>
        {monthGrid(month).map((week, w) => (
          <tr key={w}>
            {week.map((day, i) => {
              if (!day) return <td key={i} />
              const dayWorkouts = byDay.get(day) ?? []
              const isSelected = day === selected
              const isToday = day === today
              // The week's rides up to and including this day (finished workouts only).
              const rides = dayWorkouts.some((w) => w.status === 'completed')
                ? (line?.weeks.get(weekOf(day))?.rides.filter((d) => d <= day).length ?? 0)
                : 0
              const target = line?.target ?? 0
              const label = [
                formatDay(day),
                isToday ? 'today' : null,
                dayWorkouts.map((w) => w.name ?? 'Workout').join(', ') || 'no workout',
                rides > 0 && target > 0 ? `ride ${rides} of ${target} this week` : null,
              ]
                .filter(Boolean)
                .join(': ')
              return (
                <td key={i} className="p-0">
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={isSelected}
                    disabled={day > today && dayWorkouts.length === 0}
                    onClick={() => onSelect(day)}
                    className={`flex h-11 w-full flex-col items-center justify-center gap-1 rounded-lg text-sm tabular-nums transition disabled:opacity-30 ${
                      isSelected
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    } ${isToday && !isSelected ? 'font-bold underline decoration-2 underline-offset-4' : ''}`}
                  >
                    {dayWorkouts.length > 0 ? (
                      <span className="relative grid h-8 w-8 place-items-center font-semibold text-neutral-900 dark:text-neutral-100">
                        <RideRing
                          rides={rides}
                          target={target}
                          size={32}
                          className="absolute inset-0"
                        />
                        <span className="relative">{parseLocalDate(day).getDate()}</span>
                      </span>
                    ) : (
                      parseLocalDate(day).getDate()
                    )}
                  </button>
                </td>
              )
            })}
            <td className="p-0">
              <WeekColumn monday={weekOf(week.find(Boolean)!)} line={line} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The week's marker, with the track joining the weeks before and after while the line runs. */
function WeekColumn({ monday, line }: { monday: string; line: GainsLine | undefined }) {
  const at = (m: string) => line?.weeks.get(m)
  // The track joins two weeks when the first is on the line and the second goes on with it,
  // or is this week, with the train on its way.
  const joins = (a: string, b: string) =>
    onTheLine(at(a)) && (onTheLine(at(b)) || at(b)?.state === 'open')
  return (
    <WeekMarker
      week={at(monday)}
      target={line?.target ?? 0}
      fromAbove={joins(previousMonday(monday), monday)}
      onBelow={joins(monday, nextMonday(monday))}
    />
  )
}

/**
 * A day you trained: a ring in as many parts as your weekly target, filled with the week's
 * rides so far. The ride that reaches the station closes the circle.
 */
function RideRing({
  rides,
  target,
  size,
  className = '',
}: {
  rides: number
  target: number
  size: number
  className?: string
}) {
  const stroke = size / 8
  const r = (size - stroke) / 2
  const around = 2 * Math.PI * r
  const parts = Math.max(target, 1)
  const gap = parts === 1 ? 0 : stroke / 2
  const part = around / parts - gap
  const filled = Math.min(rides, parts)
  // Dashes, starting at the top: the filled parts, then nothing for the rest of the way round.
  const dashes = Array.from({ length: filled }, (_, i) => [part, i < filled - 1 ? gap : around])
  return (
    <svg
      aria-hidden="true"
      data-rides={filled}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`-rotate-90 ${className}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={`${part} ${gap}`}
        className="fill-white stroke-neutral-200 dark:fill-neutral-900 dark:stroke-neutral-700"
      />
      {filled > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={dashes.flat().join(' ')}
          className="stroke-brand-600 dark:stroke-brand-500"
        />
      )}
    </svg>
  )
}

function DayWorkouts({
  day,
  workouts,
  isFuture,
}: {
  day: string
  workouts: WorkoutSummary[]
  isFuture: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold">{formatDay(day)}</h2>
      {workouts.length === 0 ? (
        <p className="text-sm text-neutral-500">{isFuture ? 'Not there yet.' : HISTORY.restDay}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <WorkoutCard workout={workout} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WorkoutCard({ workout }: { workout: WorkoutSummary }) {
  const inProgress = workout.status === 'in_progress'
  return (
    <Link
      to={inProgress ? '/workout' : `/history/${workout.id}`}
      className="card flex flex-col gap-1 p-3 transition hover:border-brand-500"
    >
      <span className="truncate font-medium">{workout.name ?? 'Workout'}</span>
      <span className="truncate text-sm text-neutral-500">
        {workout.exercise_names.join(' · ') || 'No exercises'}
      </span>
      <span className="flex gap-3 text-sm">
        {inProgress ? (
          <span className="font-medium text-brand-600 dark:text-brand-500">In progress</span>
        ) : (
          <>
            <span>{plural(workout.set_count, 'set')}</span>
            <span className="text-neutral-500">{formatVolume(workout.volume_kg)}</span>
          </>
        )}
      </span>
    </Link>
  )
}
