// The passport on the Progress tab: stamps you've earned (newest first) and the next one of
// each kind, or every stamp grouped by kind. The rules live in data/passport.ts.
import { useState } from 'react'
import type { Passport as PassportData, Stamp, StampKind } from '../data/passport'
import { formatShortDay } from '../lib/format'
import { usePassport } from '../passport'

const KINDS: { kind: StampKind; name: string; unit: string }[] = [
  { kind: 'rides', name: 'Rides', unit: 'rides' },
  { kind: 'weight', name: 'Weight hauled', unit: 'tonnes' },
  { kind: 'prs', name: 'Personal records', unit: 'PRs' },
  { kind: 'streak', name: 'Gains Line', unit: 'in a row' },
  { kind: 'climbing', name: 'Climbing', unit: 'weeks' },
  { kind: 'explorer', name: 'Explorer', unit: 'explored' },
]
const unitOf = (kind: StampKind) => KINDS.find((k) => k.kind === kind)!.unit

export function Passport() {
  const data = usePassport()
  const [all, setAll] = useState(false)
  if (!data) return null
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
            <StampList stamps={data.stamps.filter((s) => s.kind === kind)} data={data} wrap />
          </div>
        ))
      ) : (
        <StampList stamps={highlights(data)} data={data} />
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
  wrap = false,
}: {
  stamps: Stamp[]
  data: PassportData
  wrap?: boolean
}) {
  return (
    <ul
      className={`flex gap-3 ${wrap ? 'flex-wrap' : 'scrollbar-none -mx-3 overflow-x-auto px-3 pb-1'}`}
    >
      {stamps.map((stamp, i) => (
        <li key={stamp.id}>
          <StampBadge stamp={stamp} progress={data.progress[stamp.kind]} tilt={i % 2 ? 6 : -8} />
        </li>
      ))}
    </ul>
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
        style={earned ? { color: `var(--stamp-${stamp.kind})`, rotate: `${tilt}deg` } : undefined}
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
