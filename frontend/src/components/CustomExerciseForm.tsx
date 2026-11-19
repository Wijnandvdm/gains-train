// Making or changing one of your own exercises: a name and, optionally, the main muscle. Used in
// the exercise picker, on the Exercises tab and on a custom exercise's page. The rules (names,
// deleting) live in data/customExercises.ts.
import { useState } from 'react'
import type { CustomExerciseInput } from '../data/customExercises'
import { useExerciseFilters } from '../exercises'
import { useAction } from '../lib/useAction'
import { ErrorMessage } from './ErrorMessage'

export function CustomExerciseForm<Result>({
  title,
  initial,
  submitLabel,
  onSave,
  onSaved,
  onCancel,
}: {
  title: string
  initial: CustomExerciseInput
  submitLabel: string
  onSave: (input: CustomExerciseInput) => Promise<Result>
  onSaved: (result: Result) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [muscle, setMuscle] = useState(initial.muscle ?? '')
  const muscles = useExerciseFilters().data?.muscles ?? []
  const save = useAction(onSave)

  return (
    <form
      aria-label={title}
      className="card flex flex-col gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        save.run({ name, muscle: muscle || null }).then(onSaved, () => {})
      }}
    >
      <h2 className="font-semibold">{title}</h2>
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="off"
          // The form opens because you want to type.
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Main muscle (optional)
        <select
          className="input capitalize"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">None</option>
          {muscles.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={save.error} />
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary flex-1"
          disabled={!name.trim() || save.isPending}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
