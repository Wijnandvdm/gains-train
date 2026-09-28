// The Gains Line on screen: streak and ticket pills, the week markers in the calendar, the
// "next station" card on the Workout screen, and the depot. The rules live in data/line.ts.
import { useState } from 'react'
import { DEPOT_WEEKS, leaveDepot, parkWeek, parkWeeks } from '../data/depot'
import { type GainsLine, type LineWeek, MAX_TICKETS, stationName } from '../data/line'
import { useGainsLine } from '../line'
import { formatDay, parseLocalDate, plural } from '../lib/format'
import { DepotIcon, TicketIcon } from './icons'

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

/** "6 stations in a row" and "1 ticket · next at 8". */
export function LinePills({
  streak,
  tickets,
  nextTicketAt,
}: {
  streak: number
  tickets: number
  nextTicketAt: number
}) {
  return (
    <div className="flex flex-wrap gap-2 text-sm font-semibold">
      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 tone-brand`}>
        <span aria-hidden="true" className="h-3 w-3 rounded-full border-[3px] border-current" />
        {streak === 0 ? 'No stations yet' : `${plural(streak, 'station')} in a row`}
      </span>
      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 tone-ticket`}>
        <TicketIcon className="h-4 w-4" />
        {plural(tickets, 'ticket')}
        {tickets < MAX_TICKETS && ` · next at ${nextTicketAt}`}
      </span>
    </div>
  )
}

/** The week column of the calendar: how that week went. */
export function WeekMarker({ week, target }: { week: LineWeek | undefined; target: number }) {
  const base = 'mx-auto grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold'
  switch (week?.state) {
    case 'reached':
      return (
        <span role="img" aria-label="Station reached" className={`${base} bg-brand-600 text-white`}>
          ✓
        </span>
      )
    case 'ticket':
      return (
        <span role="img" aria-label="Saved by a ticket" className={`${base} tone-ticket`}>
          <TicketIcon className="h-4 w-4" />
        </span>
      )
    case 'missed':
      return (
        <span
          role="img"
          aria-label="Missed"
          className={`${base} border-2 border-neutral-300 dark:border-neutral-700`}
        />
      )
    case 'depot':
      return (
        <span
          role="img"
          aria-label="Parked in the depot"
          className={`${base} bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300`}
        >
          <DepotIcon className="h-4 w-4" />
        </span>
      )
    case 'open':
      return (
        <span
          role="img"
          aria-label={`${week.rides.length} of ${target} rides so far`}
          className={`${base} border-2 border-dashed border-brand-600 text-brand-700 dark:border-brand-500 dark:text-brand-500`}
        >
          {week.rides.length}/{target}
        </span>
      )
    default:
      return null
  }
}

/** "Can you make it to the next station?" — this week's progress towards the next station. */
export function NextStationCard() {
  const line = useGainsLine()
  if (!line) return null
  const { thisWeek, lastWeek, streak, target } = line
  const reached = thisWeek.state === 'reached'
  const parked = thisWeek.state === 'depot'
  const rides = thisWeek.rides.length
  const left = target - rides
  const stops = Math.max(target, rides)
  const parkLastWeek = lastWeek && (
    <button
      type="button"
      onClick={() => void parkWeek(lastWeek.monday)}
      className="mt-1 block font-semibold underline"
    >
      Were you away? Park it in the depot
    </button>
  )

  return (
    <section aria-label="The Gains Line" className="card flex flex-col gap-3 p-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-500">
          {reached ? 'Station reached' : parked ? 'In the depot' : 'Next station'}
        </p>
        <h2 className="text-lg font-bold">
          {reached
            ? `${stationName(streak)} ✓`
            : parked
              ? `Parked until ${formatDay(line.parkedUntil!)}`
              : stationName(streak + 1)}
        </h2>
      </div>

      {parked ? (
        <p className="text-sm text-neutral-500">
          {streak > 0
            ? `Your streak of ${plural(streak, 'station')} waits for you.`
            : 'Your line starts when you’re back.'}{' '}
          Rides still count: reach {target} in a week and it’s a station anyway.
        </p>
      ) : (
        <>
          {!reached && lastWeek?.state === 'ticket' && (
            <div className={`rounded-lg px-3 py-2 text-sm tone-ticket`}>
              Last week you rode {plural(lastWeek.rides.length, 'time')}. Your ticket got you
              through, so the streak lives on: {plural(streak, 'station')}.{parkLastWeek}
            </div>
          )}
          {!reached && lastWeek?.state === 'missed' && (
            <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Last week fell short, so a new line starts here.
              {parkLastWeek}
            </div>
          )}

          <div>
            <div
              role="img"
              aria-label={`${rides} of ${target} rides this week`}
              className="flex items-center"
            >
              {Array.from({ length: stops }, (_, i) => (
                <Stop key={i} done={i < rides} goal={i === stops - 1} first={i === 0} />
              ))}
            </div>
            <div aria-hidden="true" className="mt-1 flex justify-between text-xs text-neutral-500">
              {Array.from({ length: stops }, (_, i) => (
                <span key={i}>
                  {i < rides
                    ? weekday.format(parseLocalDate(thisWeek.rides[i]!))
                    : i === rides
                      ? `${left} more`
                      : ''}
                </span>
              ))}
            </div>
          </div>

          {reached ? (
            <p className={`rounded-lg px-3 py-2 text-sm tone-brand`}>
              {plural(streak, 'station')} in a row!{' '}
              {line.tickets < MAX_TICKETS
                ? 'Another ride this week earns a ticket.'
                : `You hold ${MAX_TICKETS} tickets, the most you can.`}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              {plural(left, 'more ride')} {new Date().getDay() === 0 ? 'today' : 'by Sunday'}{' '}
              {streak > 0
                ? `keep${left === 1 ? 's' : ''} your streak going.`
                : `reach${left === 1 ? 'es' : ''} your first station.`}
            </p>
          )}
        </>
      )}

      <LinePills streak={streak} tickets={line.tickets} nextTicketAt={line.nextTicketAt} />
      {!reached && <DepotControls line={line} compact />}
    </section>
  )
}

/**
 * Park the train for 1–4 weeks, or leave the depot. `compact` starts as a single link (on the
 * Workout screen); in Settings the choices show straight away.
 */
export function DepotControls({ line, compact = false }: { line: GainsLine; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)

  if (line.parkedUntil) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {!compact && <span>Parked until {formatDay(line.parkedUntil)}.</span>}
        <button type="button" className="btn" onClick={() => void leaveDepot()}>
          Leave the depot
        </button>
      </div>
    )
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start text-sm text-neutral-500 underline"
      >
        <DepotIcon className="h-4 w-4" />
        Going away? Park in the depot
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-neutral-500">
        Holiday or injury? Weeks in the depot don’t count against your streak, and no ticket is
        spent. Starting this week, park for:
      </p>
      <div role="group" aria-label="Park in the depot for" className="flex gap-2">
        {DEPOT_WEEKS.map((weeks) => (
          <button
            key={weeks}
            type="button"
            className="chip flex-1 justify-center"
            onClick={() => void parkWeeks(weeks)}
          >
            {plural(weeks, 'week')}
          </button>
        ))}
      </div>
      {compact && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="self-start text-sm text-neutral-500 underline"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

function Stop({ done, goal, first }: { done: boolean; goal: boolean; first: boolean }) {
  const color = done
    ? 'border-brand-600 bg-brand-600'
    : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
  return (
    <>
      {!first && (
        <span
          aria-hidden="true"
          className={`h-1.5 flex-1 ${done ? 'bg-brand-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
        />
      )}
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-full border-4 ${goal ? `h-7 w-7 ${done ? color : 'border-brand-600 bg-white dark:bg-neutral-900'}` : `h-5 w-5 ${color}`}`}
      />
    </>
  )
}
