// An exercise's machine settings (Seat 4, Pad L) as chips, changed right there: on the set
// card, in the routine editor and on the exercise's page. The rules live in
// data/machineSettings.ts.
import { useState } from 'react'
import type { MachineSetting } from '../data/db'
import {
  MAX_SETTING_NAME,
  MAX_SETTING_VALUE,
  MAX_SETTINGS,
  saveMachineSettings,
  settingLabel,
  useMachineSettings,
} from '../data/machineSettings'
import { useAction } from '../lib/useAction'
import { ErrorMessage } from './ErrorMessage'

export function MachineSettings({ exerciseId }: { exerciseId: string }) {
  const settings = useMachineSettings(exerciseId)
  const [editing, setEditing] = useState(false)
  if (settings === undefined) return null
  if (editing) {
    return (
      <EditSettings exerciseId={exerciseId} initial={settings} onDone={() => setEditing(false)} />
    )
  }
  if (settings.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="self-start text-sm text-neutral-500 underline"
      >
        + Machine settings
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ul aria-label="Machine settings" className="contents">
        {settings.map((s, i) => (
          <li
            key={i}
            className="rounded-md bg-neutral-100 px-2 py-0.5 text-sm font-medium dark:bg-neutral-800"
          >
            {settingLabel(s)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-label="Change machine settings"
        onClick={() => setEditing(true)}
        className="rounded-md px-1.5 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        ✎
      </button>
    </div>
  )
}

const input =
  'w-full min-w-0 rounded-md border border-transparent bg-neutral-100 px-2 py-1.5 text-sm outline-none focus:border-train-500 dark:bg-neutral-800'

function EditSettings({
  exerciseId,
  initial,
  onDone,
}: {
  exerciseId: string
  initial: MachineSetting[]
  onDone: () => void
}) {
  const [rows, setRows] = useState(initial.length ? initial : [{ name: '', value: '' }])
  const save = useAction(saveMachineSettings)
  const update = (i: number, patch: Partial<MachineSetting>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <form
      aria-label="Machine settings"
      className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900"
      onSubmit={(e) => {
        e.preventDefault()
        save.run(exerciseId, rows).then(onDone, () => {})
      }}
    >
      <p className="text-xs text-neutral-500">
        How you set up the machine, e.g. Seat 4 or Pad L. Saved for next time.
      </p>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-1.5">
          <input
            aria-label={`Setting ${i + 1} name`}
            placeholder="Seat"
            value={row.name}
            maxLength={MAX_SETTING_NAME}
            onChange={(e) => update(i, { name: e.target.value })}
            className={input}
          />
          <input
            aria-label={`Setting ${i + 1} value`}
            placeholder="4"
            value={row.value}
            maxLength={MAX_SETTING_VALUE}
            onChange={(e) => update(i, { value: e.target.value })}
            className={input}
          />
          <button
            type="button"
            aria-label={`Remove setting ${i + 1}`}
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
      ))}
      {rows.length < MAX_SETTINGS && (
        <button
          type="button"
          onClick={() => setRows([...rows, { name: '', value: '' }])}
          className="self-start text-sm font-medium text-train-700 dark:text-train-500"
        >
          + Add setting
        </button>
      )}
      <ErrorMessage error={save.error} prefix="Couldn't save:" />
      <div className="flex gap-2">
        <button type="button" className="btn flex-1 py-1.5" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary flex-1 py-1.5" disabled={save.isPending}>
          Save
        </button>
      </div>
    </form>
  )
}
