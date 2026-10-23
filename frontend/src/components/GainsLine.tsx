// The Gains Line on screen: your weekly goal and streak. The slim bar on the Workout screen
// (tap it for the details), the streak and ticket pills, the week markers in the calendar,
// and the depot. The rules live in data/line.ts. Pills and markers explain themselves when
// tapped (no legends).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEPOT_WEEKS, leaveDepot, parkWeek, parkWeeks } from '../data/depot'
import {
  type GainsLine,
  isMilestone,
  type LineWeek,
  MAX_TICKETS,
  milestoneName,
  nextMilestone,
  WEEKS_PER_TICKET,
} from '../data/line'
import { useGainsLine } from '../line'
import { formatDay, parseLocalDate, plural } from '../lib/format'
import { Explain } from './Explain'
import { DepotIcon, TicketIcon } from './icons'

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** "3 more to two months": the way to the next milestone. */
function toNext(streak: number): string {
  const next = nextMilestone(streak)
  return `${next - streak} more to ${milestoneName(next)}`
}

/** In a bubble about your weekly target: straight to where you change it. */
const changeTarget = (
  <>
    Want a different weekly goal?{' '}
    <Link to="/settings#weekly-target" className="font-semibold whitespace-nowrap underline">
      Change it →
    </Link>
  </>
)

/** "5 weeks in a row" and "1 ticket · next at 8"; tap one for what it means. */
export function LinePills({ line }: { line: GainsLine }) {
  const { streak, tickets, target, nextTicketAt } = line
  return (
    <div className="flex flex-wrap gap-2 text-sm font-semibold">
      <Explain
        text={
          streak === 0
            ? `No streak yet: reach your weekly goal of ${plural(target, 'workout')} to start one.`
            : `${plural(streak, 'week')} in a row: every week you reach your goal of ${plural(target, 'workout')} counts. ${capital(toNext(streak))}.`
        }
        more={changeTarget}
      >
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 tone-done">
          <span aria-hidden="true" className="h-3 w-3 rounded-full border-[3px] border-current" />
          {streak === 0 ? 'No streak yet' : `${plural(streak, 'week')} in a row`}
        </span>
      </Explain>
      <Explain
        text={`Tickets save your streak in a week that falls short. You earn one every ${WEEKS_PER_TICKET} weeks in a row and one for each workout above your goal in a week, and hold at most ${MAX_TICKETS}.${tickets < MAX_TICKETS ? ` The next one comes at ${nextTicketAt} weeks in a row.` : ''}`}
      >
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 tone-ticket">
          <TicketIcon className="h-4 w-4" />
          {plural(tickets, 'ticket')}
          {tickets < MAX_TICKETS && ` · next at ${nextTicketAt}`}
        </span>
      </Explain>
    </div>
  )
}

/** What happened in a week, for its marker's bubble. */
function weekStory(week: LineWeek, target: number): string {
  const rides = `${week.rides.length} of ${plural(target, 'workout')}`
  switch (week.state) {
    case 'reached':
      return `Week goal reached: ${plural(week.rides.length, 'workout')}, your goal of ${target}.${isMilestone(week.streak) ? ` ${capital(milestoneName(week.streak))} in a row!` : ''}`
    case 'ticket':
      return `Saved by a ticket: ${rides}, and a ticket kept your streak going.`
    case 'missed':
      return `Missed: ${rides} and no ticket to save it, so the streak started over.`
    case 'depot':
      return 'In the depot: parked for a holiday or injury, so this week doesn’t count against your streak.'
    case 'open': {
      const left = target - week.rides.length
      return `This week so far: ${rides}. ${plural(left, 'more workout')} by Sunday reach${left === 1 ? 'es' : ''} this week’s goal.`
    }
    default:
      return ''
  }
}

/**
 * The week column of the calendar: how that week went, on a track like a metro map. The track
 * runs on from the week before and into the week after while the line goes on; a missed week
 * breaks it.
 */
export function WeekMarker({
  week,
  target,
  fromAbove,
  onBelow,
}: {
  week: LineWeek | undefined
  target: number
  /** The line comes in from the week before. */
  fromAbove: boolean
  /** The line goes on into the week after. */
  onBelow: boolean
}) {
  // The track reaches past the cell, over the gap between the calendar's rows.
  const track = 'absolute left-1/2 w-1 -translate-x-1/2 bg-train-600 dark:bg-train-500'
  return (
    <div className="relative grid h-11 place-items-center">
      {fromAbove && (
        <span aria-hidden="true" data-track="above" className={`${track} -top-0.5 bottom-1/2`} />
      )}
      {onBelow && (
        <span aria-hidden="true" data-track="below" className={`${track} top-1/2 -bottom-0.5`} />
      )}
      {week && week.state !== 'before' ? (
        <span className="relative">
          <Explain text={weekStory(week, target)} more={changeTarget} align="right">
            <Marker week={week} target={target} />
          </Explain>
        </span>
      ) : null}
    </div>
  )
}

function Marker({ week, target }: { week: LineWeek | undefined; target: number }) {
  const base = 'grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold'
  switch (week?.state) {
    case 'reached':
      return (
        <span
          role="img"
          aria-label="Week goal reached"
          className="block h-5 w-5 rounded-full border-4 border-done-600 bg-white dark:border-done-500 dark:bg-neutral-900"
        />
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
          className={`${base} border-2 border-dashed border-train-600 bg-white text-train-700 dark:border-train-500 dark:bg-neutral-900 dark:text-train-500`}
        >
          {week.rides.length}/{target}
        </span>
      )
    default:
      return null
  }
}

/** This week's goal and your streak, in words: what the bar says, and what it says next. */
function headline(line: GainsLine): { main: string; sub: string } {
  const { thisWeek, streak, target } = line
  const left = target - thisWeek.rides.length
  if (thisWeek.state === 'depot') {
    return {
      main: `In the depot until ${formatDay(line.parkedUntil!)}`,
      sub:
        streak > 0
          ? `Your streak of ${plural(streak, 'week')} waits for you`
          : 'Your streak starts when you’re back',
    }
  }
  if (thisWeek.state === 'reached') {
    return isMilestone(streak)
      ? {
          main: `${capital(milestoneName(streak))} in a row! 🎉`,
          sub: `Keep going for ${milestoneName(nextMilestone(streak))}!`,
        }
      : {
          main: 'This week’s goal reached!',
          sub: `${plural(streak, 'week')} in a row · ${toNext(streak)}`,
        }
  }
  const when = parseLocalDate(line.today).getDay() === 0 ? 'today' : 'by Sunday'
  return {
    main:
      left === 1
        ? `Only 1 more workout to reach this week’s goal of ${target}!`
        : `${left} more workouts to reach this week’s goal of ${target}`,
    sub:
      streak > 0
        ? `${plural(streak, 'week')} in a row · reach it ${when} to keep it going`
        : `Reach it ${when} to start your streak`,
  }
}

/**
 * Your week on the Workout screen: one slim line, so the workout comes first. Tap it for the
 * details (this week's workouts, last week, tickets, the depot).
 */
export function WeekGoalBar() {
  const line = useGainsLine()
  const [open, setOpen] = useState(false)
  if (!line) return null
  const { thisWeek, lastWeek, streak, target } = line
  const reached = thisWeek.state === 'reached'
  const parked = thisWeek.state === 'depot'
  const rides = thisWeek.rides.length
  const left = target - rides
  const stops = Math.max(target, rides)
  const { main, sub } = headline(line)
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
    <section aria-label="The Gains Line" className="card flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 p-2.5 text-left"
      >
        {/* This week at a glance: a dot per workout of the goal. */}
        <span aria-hidden="true" className="flex shrink-0 gap-1">
          {Array.from({ length: stops }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i < rides ? 'bg-done-600' : 'border-2 border-neutral-300 dark:border-neutral-600'}`}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{main}</span>
          <span className="block text-xs text-neutral-500">{sub}</span>
        </span>
        <span
          aria-hidden="true"
          className={`text-neutral-400 transition ${open ? 'rotate-90' : ''}`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-neutral-200 p-3 dark:border-neutral-800">
          {parked ? (
            <p className="text-sm text-neutral-500">
              Workouts still count: reach {target} in a week and it counts anyway.
            </p>
          ) : (
            <>
              {!reached && lastWeek?.state === 'ticket' && (
                <div className={`rounded-lg px-3 py-2 text-sm tone-ticket`}>
                  Last week you did {plural(lastWeek.rides.length, 'workout')}. Your ticket got you
                  through, so the streak lives on: {plural(streak, 'week')}.{parkLastWeek}
                </div>
              )}
              {!reached && lastWeek?.state === 'missed' && (
                <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  Last week fell short, so a new streak starts here.
                  {parkLastWeek}
                </div>
              )}

              <div>
                <div
                  role="img"
                  aria-label={`${rides} of ${target} workouts this week`}
                  className="flex items-center"
                >
                  {Array.from({ length: stops }, (_, i) => (
                    <Stop key={i} done={i < rides} goal={i === stops - 1} first={i === 0} />
                  ))}
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1 flex justify-between text-xs text-neutral-500"
                >
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

              {reached && (
                <p className={`rounded-lg px-3 py-2 text-sm tone-done`}>
                  {line.tickets < MAX_TICKETS
                    ? 'Another workout this week earns a ticket.'
                    : `You hold ${MAX_TICKETS} tickets, the most you can.`}
                </p>
              )}
            </>
          )}

          <LinePills line={line} />
          {!reached && <DepotControls line={line} compact />}
        </div>
      )}
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
    ? 'border-done-600 bg-done-600'
    : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
  return (
    <>
      {!first && (
        <span
          aria-hidden="true"
          className={`h-1.5 flex-1 ${done ? 'bg-done-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
        />
      )}
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-full border-4 ${goal ? `h-7 w-7 ${done ? color : 'border-train-600 bg-white dark:bg-neutral-900'}` : `h-5 w-5 ${color}`}`}
      />
    </>
  )
}
