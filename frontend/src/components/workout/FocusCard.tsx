import { useState } from 'react'
import { formatSet, parseReps, parseWeight, weightInputText } from '../../lib/format'
import { type NextSet, weightStep } from '../../workout/plan'
import { ExerciseThumb } from '../ExerciseImage'

type Props = {
  next: NextSet
  onConfirm: (values: { weight_kg: number; reps: number }) => void
  onSkipExercise?: () => void
}

const toText = weightInputText

/**
 * The set to do now, prefilled from last time: one tap on ✓ logs it. Mount it with a
 * key per set (see WorkoutPage) so the prefill resets when the next set comes up.
 */
export function FocusCard({ next, onConfirm, onSkipExercise }: Props) {
  const { exercise } = next.item
  const [weight, setWeight] = useState(toText(next.prefill.weight))
  const [reps, setReps] = useState(toText(next.prefill.reps))
  const step = weightStep(exercise)

  const repCount = parseReps(reps)
  const weightKg = weight.trim() === '' ? 0 : parseWeight(weight)
  const valid = repCount !== null && repCount > 0 && weightKg !== null

  function nudge(value: string, delta: number, parse: (v: string) => number | null) {
    const current = parse(value) ?? 0
    return weightInputText(Math.max(0, current + delta))
  }

  return (
    <section
      aria-label="Current set"
      className="card flex flex-col gap-4 border-brand-500 p-4 shadow-sm"
    >
      <header className="flex items-center gap-3">
        <ExerciseThumb name={exercise.name} src={exercise.image_urls[0]} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{exercise.name}</p>
          <p className="text-sm text-neutral-500">
            Set {next.setNumber} of {next.plannedSets}
            {next.previous && (
              <> · last time {formatSet(next.previous.weight_kg, next.previous.reps)}</>
            )}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stepper
          label="kg"
          value={weight}
          inputMode="decimal"
          onChange={setWeight}
          onMinus={() => setWeight(nudge(weight, -step, parseWeight))}
          onPlus={() => setWeight(nudge(weight, step, parseWeight))}
          step={step}
        />
        <Stepper
          label="reps"
          value={reps}
          inputMode="numeric"
          onChange={setReps}
          onMinus={() => setReps(nudge(reps, -1, parseReps))}
          onPlus={() => setReps(nudge(reps, 1, parseReps))}
          step={1}
        />
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={() => valid && onConfirm({ weight_kg: weightKg, reps: repCount })}
        className="btn btn-primary py-4 text-lg"
      >
        ✓ Done
      </button>
      {onSkipExercise && (
        <button
          type="button"
          onClick={onSkipExercise}
          aria-label={`Skip ${exercise.name}`}
          className="-mt-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Skip this stop
        </button>
      )}
    </section>
  )
}

function Stepper({
  label,
  value,
  inputMode,
  onChange,
  onMinus,
  onPlus,
  step,
}: {
  label: string
  value: string
  inputMode: 'decimal' | 'numeric'
  onChange: (value: string) => void
  onMinus: () => void
  onPlus: () => void
  step: number
}) {
  const button =
    'h-12 w-12 shrink-0 rounded-lg bg-neutral-100 text-xl font-semibold active:bg-neutral-200 dark:bg-neutral-800 dark:active:bg-neutral-700'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex w-full items-center gap-1.5">
        <button
          type="button"
          className={button}
          onClick={onMinus}
          aria-label={`− ${step} ${label}`}
        >
          −
        </button>
        <input
          aria-label={label}
          inputMode={inputMode}
          value={value}
          placeholder="–"
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-full min-w-0 rounded-lg bg-transparent py-2 text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="button" className={button} onClick={onPlus} aria-label={`+ ${step} ${label}`}>
          +
        </button>
      </div>
      <span className="text-xs text-neutral-500 uppercase">{label}</span>
    </div>
  )
}
