import { TrainIcon } from '../icons'

type Station = { name: string; done: number; planned: number }

/**
 * Workout progress as a railway: a station at the end of each exercise, and the train
 * moving along as sets are logged.
 */
export function WorkoutTrack({ stations }: { stations: Station[] }) {
  const total = stations.reduce((sum, s) => sum + s.planned, 0)
  const done = stations.reduce((sum, s) => sum + Math.min(s.done, s.planned), 0)
  if (total === 0) return null
  const at = (fraction: number) => `calc(0.75rem + (100% - 1.5rem) * ${fraction})`

  // Each station sits where its exercise's sets end along the line.
  const positions = stations.reduce<number[]>(
    (acc, s) => [...acc, (acc.at(-1) ?? 0) + s.planned / total],
    [],
  )

  return (
    <div
      role="progressbar"
      aria-label="Workout progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total} sets`}
      className="relative h-11"
    >
      {/* Sleepers, then the rail; the part already travelled is in brand green. */}
      <div
        className="absolute inset-x-3 top-8 h-2.5 -translate-y-1/2"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, var(--chart-grid) 0 3px, transparent 3px 9px)',
        }}
      />
      <div className="absolute inset-x-3 top-8 h-0.5 -translate-y-1/2 rounded bg-neutral-300 dark:bg-neutral-700" />
      <div
        className="absolute top-8 left-3 h-0.5 -translate-y-1/2 rounded bg-brand-600 motion-safe:transition-[width] motion-safe:duration-700"
        style={{ width: `calc((100% - 1.5rem) * ${done / total})` }}
      />
      {stations.map((s, i) => (
        <span
          key={i}
          title={s.name}
          className={`absolute top-8 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            s.done >= s.planned
              ? 'border-brand-600 bg-brand-600'
              : 'border-neutral-400 bg-neutral-50 dark:border-neutral-500 dark:bg-neutral-950'
          }`}
          style={{ left: at(positions[i]!) }}
        />
      ))}
      {/* The icon faces left; mirror it so the train heads down the line. */}
      <TrainIcon
        className="absolute top-0 h-7 w-7 -translate-x-1/2 -scale-x-100 text-brand-600 motion-safe:transition-[left] motion-safe:duration-700 dark:text-brand-500"
        style={{ left: at(done / total) }}
      />
    </div>
  )
}
