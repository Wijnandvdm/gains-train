// The passport on the Progress tab: stamps you've earned (newest first) and the next one of
// each kind, or every stamp grouped by kind. Tap a stamp for what it's for (under its row: a
// bubble would be cut off in the row that scrolls sideways). The rules live in data/passport.ts.
import { useState } from 'react'
import type { Passport as PassportData, Stamp, StampKind } from '../data/passport'
import { formatDay, formatShortDay } from '../lib/format'
import { usePassport } from '../passport'

const KINDS: { kind: StampKind; name: string; unit: string }[] = [
  { kind: 'rides', name: 'Rides', unit: 'rides' },
  { kind: 'weight', name: 'Weight hauled', unit: 'tonnes' },
  { kind: 'prs', name: 'Personal records', unit: 'PRs' },
  { kind: 'streak', name: 'Gains Line', unit: 'in a row' },
  { kind: 'steam', name: 'Full steam ahead', unit: 'weeks' },
  { kind: 'explorer', name: 'Explorer', unit: 'explored' },
]
const unitOf = (kind: StampKind) => KINDS.find((k) => k.kind === kind)!.unit

/** What a stamp is for, and when you earned it or how far you are. */
function stampStory(stamp: Stamp, progress: number): string {
  const g = stamp.goal
  const rule = {
    rides: g === 1 ? 'Your first finished workout.' : `${g} finished workouts.`,
    weight: `${g} tonnes lifted in total (weight × reps over all your workouts), as much as ${stamp.detail.toLowerCase()}.`,
    prs:
      g === 1
        ? 'Your first personal record: beating your best on an exercise.'
        : `${g} workouts where you beat your best on an exercise.`,
    streak: `Your weekly goal reached ${g} weeks in a row.`,
    steam: `One exercise stronger every week, ${g} weeks in a row.`,
    explorer:
      stamp.badge === 'All'
        ? 'Every exercise in the library, done at least once.'
        : `${g} different exercises from the library, done at least once.`,
  }[stamp.kind]
  const status = stamp.earnedOn
    ? `Earned ${formatDay(stamp.earnedOn)}.`
    : stamp.kind === 'streak' || stamp.kind === 'steam'
      ? `Best so far: ${progress}.`
      : `So far: ${progress} of ${g}.`
  return `${rule} ${status}`
}

export function Passport() {
  const data = usePassport()
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null) // the stamp explained
  if (!data) return null
  const list = { data, open, onOpen: (id: string) => setOpen(open === id ? null : id) }
  const earned = data.stamps.filter((s) => s.earnedOn)

  return (
    <section aria-labelledby="passport-heading" className="card flex flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="passport-heading" className="font-semibold">
          Passport
        </h2>
        <span className="text-sm text-neutral-500">
          {earned.length} of {data.stamps.length} stamps
        </span>
      </div>

      {all ? (
        KINDS.map(({ kind, name }) => (
          <div key={kind} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-neutral-500">{name}</h3>
            <StampList stamps={data.stamps.filter((s) => s.kind === kind)} {...list} wrap />
          </div>
        ))
      ) : (
        <StampList stamps={highlights(data)} {...list} />
      )}

      <button
        type="button"
        onClick={() => setAll(!all)}
        className="self-start text-sm text-neutral-500 underline"
      >
        {all ? 'Show less' : 'Show all stamps'}
      </button>
    </section>
  )
}

/** Earned stamps, newest first, then the next one to earn of each kind. */
function highlights(data: PassportData): Stamp[] {
  const earned = data.stamps
    .filter((s) => s.earnedOn)
    .sort((a, b) => b.earnedOn!.localeCompare(a.earnedOn!))
  const next = KINDS.flatMap(({ kind }) => {
    const stamp = data.stamps.find((s) => s.kind === kind && !s.earnedOn)
    return stamp ? [stamp] : []
  })
  return [...earned, ...next]
}

function StampList({
  stamps,
  data,
  open,
  onOpen,
  wrap = false,
}: {
  stamps: Stamp[]
  data: PassportData
  /** The stamp whose explanation shows (under this row, when it's in it). */
  open: string | null
  onOpen: (id: string) => void
  wrap?: boolean
}) {
  const explained = stamps.find((s) => s.id === open)
  return (
    <div className="flex flex-col gap-2">
      <ul
        className={`flex gap-3 ${wrap ? 'flex-wrap' : 'scrollbar-none -mx-3 overflow-x-auto px-3 pb-1'}`}
      >
        {stamps.map((stamp, i) => (
          <li key={stamp.id}>
            <button
              type="button"
              aria-expanded={open === stamp.id}
              onClick={() => onOpen(stamp.id)}
              className={`rounded-lg p-0.5 ${open === stamp.id ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}
            >
              <StampBadge
                stamp={stamp}
                progress={data.progress[stamp.kind]}
                tilt={i % 2 ? 6 : -8}
              />
            </button>
          </li>
        ))}
      </ul>
      {explained && (
        <p role="note" className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
          <span className="font-semibold">{explained.title}:</span>{' '}
          {stampStory(explained, data.progress[explained.kind])}
        </p>
      )}
    </div>
  )
}

/** A rubber stamp: double ring in the kind's ink, a little crooked. Unearned: dashed and grey. */
export function StampBadge({
  stamp,
  progress,
  tilt = -8,
}: {
  stamp: Stamp
  progress?: number
  tilt?: number
}) {
  const earned = stamp.earnedOn !== null
  const value =
    stamp.badge ??
    (stamp.kind === 'weight' ? `${stamp.goal}t` : stamp.goal === 1 ? '1st' : String(stamp.goal))
  const label = earned
    ? `${stamp.title} (${stamp.detail}), earned ${formatShortDay(stamp.earnedOn!)}`
    : `${stamp.title} (${stamp.detail}): ${progress ?? 0} of ${stamp.goal}`

  return (
    <div
      role="img"
      aria-label={label}
      className="flex w-20 flex-col items-center gap-1 text-center"
    >
      <div
        aria-hidden="true"
        className={`grid h-16 w-16 place-items-center rounded-full border-[3px] ${
          earned
            ? 'shadow-[inset_0_0_0_3px_var(--chart-surface),inset_0_0_0_5px_currentColor]'
            : 'border-dashed border-neutral-300 text-neutral-400 dark:border-neutral-700 dark:text-neutral-500'
        }`}
        style={earned ? { color: `var(--ink-${stamp.kind})`, rotate: `${tilt}deg` } : undefined}
      >
        <span className="flex flex-col leading-none">
          <span className="text-lg font-black tabular-nums">{value}</span>
          <span className="text-[8px] font-bold tracking-wider uppercase">
            {unitOf(stamp.kind)}
          </span>
        </span>
      </div>
      <span
        aria-hidden="true"
        className="line-clamp-2 text-[11px] leading-tight text-neutral-600 dark:text-neutral-300"
      >
        {stamp.kind === 'weight' ? stamp.detail : stamp.title}
      </span>
      <span aria-hidden="true" className="text-[11px] leading-tight text-neutral-500 tabular-nums">
        {earned ? formatShortDay(stamp.earnedOn!) : `${progress ?? 0}/${stamp.goal}`}
      </span>
    </div>
  )
}
