import { Link, useSearchParams } from 'react-router-dom'
import type { RoutineOut, WorkoutSummary } from '../data/types'
import { BackIcon } from '../components/icons'
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
import { formatDay, formatVolume, localDateString, parseLocalDate } from '../lib/format'
import { useRoutine } from '../routine'
import { useWorkoutSummaries } from '../workout/hooks'

/** Routine day → colour token; days past the third (and non-routine workouts) are "other". */
const DAY_COLORS = ['var(--day-1)', 'var(--day-2)', 'var(--day-3)']
const OTHER_COLOR = 'var(--day-other)'

function dayColors(routine: RoutineOut | null | undefined): Map<string, string> {
  return new Map(routine?.days.slice(0, DAY_COLORS.length).map((d, i) => [d.id, DAY_COLORS[i]!]))
}

const colorOf = (colors: Map<string, string>, w: WorkoutSummary) =>
  (w.routine_day_id && colors.get(w.routine_day_id)) || OTHER_COLOR

export function HistoryPage() {
  // Month and selected day live in the URL, so "back" from a workout returns right here.
  const [params, setParams] = useSearchParams()
  const today = localDateString()
  const month: Month = isValidMonth(params.get('month')) ? params.get('month')! : currentMonth()
  const { from, to } = monthRange(month)

  const { data: workouts = [], isPending } = useWorkoutSummaries(from, to)
  const { data: routine } = useRoutine()
  const colors = dayColors(routine)

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
  const legend = routine?.days.slice(0, DAY_COLORS.length) ?? []
  const hasOther = workouts.some((w) => colorOf(colors, w) === OTHER_COLOR)

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
          colors={colors}
          selected={selected}
          today={today}
          onSelect={(day) => go({ day })}
        />

        {(legend.length > 0 || hasOther) && workouts.length > 0 && (
          <ul
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500"
            aria-label="Legend"
          >
            {legend.map((d, i) => (
              <li key={d.id} className="flex items-center gap-1.5">
                <Dot color={DAY_COLORS[i]!} />
                {d.name}
              </li>
            ))}
            {hasOther && (
              <li className="flex items-center gap-1.5">
                <Dot color={OTHER_COLOR} />
                Other
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
              colors={colors}
              isFuture={selected > today}
            />
          )}
        </>
      )}
    </section>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}

function CalendarGrid({
  month,
  byDay,
  colors,
  selected,
  today,
  onSelect,
}: {
  month: Month
  byDay: Map<string, WorkoutSummary[]>
  colors: Map<string, string>
  selected: string | null
  today: string
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
              const label = [
                formatDay(day),
                isToday ? 'today' : null,
                dayWorkouts.map((w) => w.name ?? 'Workout').join(', ') || 'no workout',
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
                    {parseLocalDate(day).getDate()}
                    <span className="flex h-2 gap-0.5">
                      {dayWorkouts.slice(0, 3).map((w) => (
                        <Dot key={w.id} color={colorOf(colors, w)} />
                      ))}
                    </span>
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DayWorkouts({
  day,
  workouts,
  colors,
  isFuture,
}: {
  day: string
  workouts: WorkoutSummary[]
  colors: Map<string, string>
  isFuture: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold">{formatDay(day)}</h2>
      {workouts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {isFuture ? 'Not there yet.' : 'Rest day. The train was in the depot. 🚂'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <WorkoutCard workout={workout} color={colorOf(colors, workout)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WorkoutCard({ workout, color }: { workout: WorkoutSummary; color: string }) {
  const inProgress = workout.status === 'in_progress'
  return (
    <Link
      to={inProgress ? '/workout' : `/history/${workout.id}`}
      className="card flex flex-col gap-1 p-3 transition hover:border-brand-500"
    >
      <span className="flex items-center gap-2">
        <Dot color={color} />
        <span className="truncate font-medium">{workout.name ?? 'Workout'}</span>
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
