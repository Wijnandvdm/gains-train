import { useState } from 'react'
import type { SetOut } from '../../api/schema'
import { formatKg, formatSet, parseReps, parseWeight } from '../../lib/format'

type Props = {
  set: SetOut
  /** "1", "2", … for work sets; "W" for warm-ups */
  label: string
  /** The matching set from last time, shown as a hint and used when ticking an empty row. */
  previous: SetOut | undefined
  onSave: (set: SetOut) => void
  onDelete: () => void
  onCompleted: () => void
}

const toText = (value: number | null) => (value === null ? '' : formatKg(value))

export function SetRow({ set, label, previous, onSave, onDelete, onCompleted }: Props) {
  // Typing edits a local draft; it's saved on blur or when ticking (not per keystroke).
  const [weight, setWeight] = useState(toText(set.weight_kg))
  const [reps, setReps] = useState(toText(set.reps))
  const [needsReps, setNeedsReps] = useState(false)
  const done = set.completed_at !== null

  function commitDraft() {
    const next = { ...set, weight_kg: parseWeight(weight), reps: parseReps(reps) }
    setWeight(toText(next.weight_kg)) // normalise, e.g. "82,50" → "82.5"
    setReps(toText(next.reps))
    if (next.weight_kg !== set.weight_kg || next.reps !== set.reps) onSave(next)
  }

  function toggleDone() {
    if (done) {
      onSave({ ...set, completed_at: null })
      return
    }
    // Empty fields take last time's numbers (what the faint placeholders showed).
    const weightKg = parseWeight(weight) ?? previous?.weight_kg ?? 0
    const repCount = parseReps(reps) ?? previous?.reps ?? null
    if (repCount === null) {
      setNeedsReps(true)
      return
    }
    setNeedsReps(false)
    setWeight(toText(weightKg))
    setReps(toText(repCount))
    onSave({ ...set, weight_kg: weightKg, reps: repCount, completed_at: new Date().toISOString() })
    onCompleted()
  }

  const input =
    'w-full rounded-md border border-transparent bg-neutral-100 px-1 py-1.5 text-center tabular-nums outline-none placeholder:text-neutral-400 focus:border-brand-500 dark:bg-neutral-800 dark:placeholder:text-neutral-500'

  return (
    <li
      className={`grid grid-cols-[2.25rem_1fr_4.5rem_3.5rem_2.5rem_1.75rem] items-center gap-1.5 rounded-lg px-1 py-1 ${
        done ? 'bg-brand-50 dark:bg-brand-900/40' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onSave({ ...set, is_warmup: !set.is_warmup })}
        className={`rounded-md py-1.5 text-sm font-semibold ${
          set.is_warmup ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500'
        }`}
        aria-label={`Set ${label}${set.is_warmup ? ' (warm-up)' : ''}: toggle warm-up`}
      >
        {label}
      </button>
      <span className="truncate text-sm text-neutral-400 tabular-nums">
        {previous ? formatSet(previous.weight_kg, previous.reps) : '–'}
      </span>
      <input
        aria-label={`Set ${label} weight (kg)`}
        inputMode="decimal"
        value={weight}
        placeholder={previous?.weight_kg !== null && previous ? formatKg(previous.weight_kg) : 'kg'}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commitDraft}
        onFocus={(e) => e.target.select()}
        className={input}
      />
      <input
        aria-label={`Set ${label} reps`}
        inputMode="numeric"
        value={reps}
        placeholder={previous?.reps != null ? String(previous.reps) : 'reps'}
        onChange={(e) => {
          setReps(e.target.value)
          setNeedsReps(false)
        }}
        onBlur={commitDraft}
        onFocus={(e) => e.target.select()}
        className={`${input} ${needsReps ? 'border-red-500!' : ''}`}
      />
      <button
        type="button"
        onClick={toggleDone}
        aria-pressed={done}
        aria-label={`Set ${label} done`}
        className={`flex h-9 items-center justify-center rounded-md text-lg font-bold transition ${
          done
            ? 'bg-brand-600 text-white'
            : 'bg-neutral-100 text-neutral-400 hover:text-neutral-700 dark:bg-neutral-800'
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete set ${label}`}
        className="text-lg text-neutral-400 hover:text-red-600"
      >
        ×
      </button>
    </li>
  )
}
