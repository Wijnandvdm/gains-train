// The Gains Line on screen: streak and ticket pills, the week markers in the calendar, and
// the "next station" card on the Workout screen. The rules live in data/line.ts.
import { type LineWeek, MAX_TICKETS, stationName } from '../data/line'
import { useGainsLine } from '../line'
import { parseLocalDate } from '../lib/format'
import { TicketIcon } from './icons'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

const GREEN = 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
const AMBER = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'

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
      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${GREEN}`}>
        <span aria-hidden="true" className="h-3 w-3 rounded-full border-[3px] border-current" />
        {streak === 0 ? 'No stations yet' : `${plural(streak, 'station')} in a row`}
      </span>
      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${AMBER}`}>
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
        <span role="img" aria-label="Saved by a ticket" className={`${base} ${AMBER}`}>
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
  const rides = thisWeek.rides.length
  const left = target - rides
  const stops = Math.max(target, rides)

  return (
    <section aria-label="The Gains Line" className="card flex flex-col gap-3 p-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-500">
          {reached ? 'Station reached' : 'Next station'}
        </p>
        <h2 className="text-lg font-bold">
          {reached ? `${stationName(streak)} ✓` : stationName(streak + 1)}
        </h2>
      </div>

      {!reached && lastWeek?.state === 'ticket' && (
        <p className={`rounded-lg px-3 py-2 text-sm ${AMBER}`}>
          Last week you rode {plural(lastWeek.rides.length, 'time')}. Your ticket got you through,
          so the streak lives on: {plural(streak, 'station')}.
        </p>
      )}
      {!reached && lastWeek?.state === 'missed' && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Last week fell short, so a new line starts here.
        </p>
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
        <p className={`rounded-lg px-3 py-2 text-sm ${GREEN}`}>
          {plural(streak, 'station')} in a row!{' '}
          {line.tickets < MAX_TICKETS
            ? 'Another ride this week earns a ticket.'
            : `You hold ${MAX_TICKETS} tickets, the most you can.`}
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          {plural(left, 'more ride')} by Sunday{' '}
          {streak > 0
            ? `keep${left === 1 ? 's' : ''} your streak going.`
            : `reach${left === 1 ? 'es' : ''} your first station.`}
        </p>
      )}

      <LinePills streak={streak} tickets={line.tickets} nextTicketAt={line.nextTicketAt} />
    </section>
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
