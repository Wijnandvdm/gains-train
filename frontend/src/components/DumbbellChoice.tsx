// One or two dumbbells, and whether the weight you log is each or both together: chosen once
// per dumbbell exercise, on its page. The rules live in data/dumbbells.ts.
import { chooseDumbbellMode, type DumbbellMode, useDumbbellMode } from '../data/dumbbells'
import type { ExerciseSummary } from '../data/types'

const CHOICES: { mode: DumbbellMode; label: string; detail: string }[] = [
  { mode: 'one', label: 'One dumbbell', detail: 'You log its weight.' },
  { mode: 'each', label: 'Two, weight of each', detail: '2 × 20 kg: log 20. Volume counts both.' },
  { mode: 'total', label: 'Two, total weight', detail: '2 × 20 kg: log 40.' },
]

export function DumbbellChoice({ exercise }: { exercise: ExerciseSummary }) {
  const mode = useDumbbellMode(exercise)
  if (!mode) return null // not a dumbbell exercise (or still loading)
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Dumbbells</h2>
      <div role="radiogroup" aria-label="Dumbbells" className="flex flex-col gap-1.5">
        {CHOICES.map((c) => (
          <label key={c.mode} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`dumbbells-${exercise.id}`}
              checked={mode === c.mode}
              onChange={() => void chooseDumbbellMode(exercise.id, c.mode)}
              className="mt-0.5 accent-train-600"
            />
            <span>
              <span className="font-medium">{c.label}</span>{' '}
              <span className="text-neutral-500">{c.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
