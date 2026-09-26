// Loaded on demand (see ExerciseProgress): Recharts is most of the app's JavaScript,
// and only this chart needs it.
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SessionPoint } from '../data/types'
import {
  formatDay,
  formatE1rm,
  formatKg,
  formatSet,
  formatShortDay,
  formatVolume,
  formatWeight,
  localDateString,
  parseLocalDate,
} from '../lib/format'

const METRICS = {
  e1rm: {
    label: 'Estimated 1RM',
    title: 'Estimated 1RM per session',
    value: (p: SessionPoint) => p.best_e1rm_kg,
    format: formatE1rm,
  },
  top: {
    label: 'Top weight',
    title: 'Heaviest set per session',
    value: (p: SessionPoint) => p.top_weight_kg,
    format: formatWeight,
  },
  volume: {
    label: 'Volume',
    title: 'Volume per session (weight × reps)',
    value: (p: SessionPoint) => p.volume_kg,
    format: formatVolume,
  },
} as const
type Metric = keyof typeof METRICS

export default function ProgressChart({ sessions }: { sessions: SessionPoint[] }) {
  const [metric, setMetric] = useState<Metric>('e1rm')
  const { title, value, format } = METRICS[metric]
  const points = sessions.map((p) => ({ ...p, time: parseLocalDate(p.performed_on).getTime() }))

  return (
    <figure className="card flex flex-col gap-2 p-3">
      <div role="group" aria-label="Chart metric" className="flex flex-wrap gap-1.5">
        {(Object.keys(METRICS) as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={metric === m}
            onClick={() => setMetric(m)}
            className={`chip text-xs ${metric === m ? 'chip-active' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
          >
            {METRICS[m].label}
          </button>
        ))}
      </div>
      <figcaption className="text-sm font-medium">{title}</figcaption>

      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => formatShortDay(localDateString(new Date(t)))}
              tick={{ fill: 'var(--color-neutral-500)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              minTickGap={24}
            />
            <YAxis
              dataKey={value}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => formatKg(Math.round(v))}
              tick={{ fill: 'var(--color-neutral-500)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-neutral-400)', strokeWidth: 1 }}
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  point={payload?.[0]?.payload as SessionPoint | undefined}
                  format={format}
                  value={value}
                />
              )}
            />
            <Line
              type="monotone"
              dataKey={value}
              stroke="var(--color-brand-600)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{
                r: 4,
                fill: 'var(--color-brand-600)',
                stroke: 'var(--chart-surface)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: 'var(--color-brand-600)',
                stroke: 'var(--chart-surface)',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* The same numbers as a table, for screen readers and anyone who prefers them. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-500">Show as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 font-medium">Top set</th>
              <th className="py-1 text-right font-medium">{METRICS[metric].label}</th>
            </tr>
          </thead>
          <tbody>
            {[...sessions].reverse().map((p) => (
              <tr
                key={p.workout_id}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="py-1">{formatDay(p.performed_on)}</td>
                <td className="py-1">{formatSet(p.top_weight_kg, p.top_weight_reps)}</td>
                <td className="py-1 text-right">{format(value(p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function ChartTooltip({
  active,
  point,
  format,
  value,
}: {
  active: boolean | undefined
  point: SessionPoint | undefined
  format: (v: number) => string
  value: (p: SessionPoint) => number
}) {
  if (!active || !point) return null
  return (
    <div className="card px-3 py-2 text-sm shadow-md">
      <p className="text-xs text-neutral-500">{formatDay(point.performed_on)}</p>
      <p className="font-semibold">{format(value(point))}</p>
      <p className="text-xs text-neutral-500">
        Top set {formatSet(point.top_weight_kg, point.top_weight_reps)} · {point.set_count} sets
      </p>
    </div>
  )
}
