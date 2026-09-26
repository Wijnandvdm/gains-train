import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePicker } from '../components/FilePicker'
import { TrainIcon } from '../components/icons'
import { readBackupFile, restoreBackup } from '../data/backup'
import { importLegacyFile } from '../data/legacyImport'
import { DEFAULT_REST_SECONDS } from '../lib/rest'
import { useAction } from '../lib/useAction'
import { routineFromHistory } from '../routine'
import { updateSettings } from '../settings'
import { useWorkoutSummaries } from '../workout/hooks'
import { recentRoutines } from '../workout/recent'

type Mode = 'split' | 'build' | 'free'
/** Rest choices in seconds; null = no rest timer at all (no countdown, beep or buzz). */
const REST_OPTIONS = [60, 90, 120, 180, null]

/** The first-open questions: how you train, and how long you rest. */
export function SetupPage() {
  const navigate = useNavigate()
  const { data: history = [] } = useWorkoutSummaries()
  const split = recentRoutines(history, 14)

  const [mode, setMode] = useState<Mode | null>(null)
  const [rest, setRest] = useState<number | null>(DEFAULT_REST_SECONDS)
  const [imported, setImported] = useState<string | null>(null)

  const finishing = useAction(async () => {
    if (mode === 'split') await routineFromHistory()
    await updateSettings({
      setup_completed_at: new Date().toISOString(),
      rest_timer_enabled: rest !== null,
      ...(rest !== null && { default_rest_seconds: rest }),
    })
    navigate(mode === 'build' ? '/routine' : '/workout', { replace: true })
  })
  const restoring = useAction(async (file: File) => {
    const backup = await restoreBackup(await readBackupFile(file))
    // A backup made before finishing setup would bring you straight back here.
    if (!backup.settings.setup_completed_at) {
      await updateSettings({ setup_completed_at: new Date().toISOString() })
    }
    navigate('/workout', { replace: true })
  })
  const importing = useAction(async (file: File) => {
    const result = await importLegacyFile(file)
    setImported(`Imported ${result.created + result.updated} workouts with ${result.sets} sets.`)
    setMode('split')
  })
  const busy = finishing.isPending || restoring.isPending || importing.isPending
  const error = finishing.error ?? restoring.error ?? importing.error

  const modes: { value: Mode; title: string; detail: string }[] = [
    ...(split.length > 0
      ? [
          {
            value: 'split' as const,
            title: 'My usual split',
            // Same order the routine gets ("Day2" before "Day10").
            detail: split
              .map((w) => w.name!)
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .join(' → '),
          },
        ]
      : []),
    {
      value: 'build',
      title: 'Build my own routine',
      detail: 'Set up your days and exercises',
    },
    { value: 'free', title: 'No fixed routine', detail: 'Pick exercises each time' },
  ]

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-brand-600 p-3 text-white">
          <TrainIcon className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold">Let's lay the tracks</h1>
        <p className="text-neutral-500">
          Two questions, then every workout is one tap per set. Choo choo.
        </p>
      </header>

      <section className="flex flex-col gap-2" aria-labelledby="been-here">
        <h2 id="been-here" className="font-semibold">
          Been here before?
        </h2>
        <div className="flex gap-2">
          <FilePicker
            label="Restore a backup"
            accept="application/json,.json"
            className="btn flex-1"
            disabled={busy}
            onFile={(file) => void restoring.run(file).catch(() => {})}
          />
          <FilePicker
            label="Import my old sheet"
            accept="text/csv,.csv"
            className="btn flex-1"
            disabled={busy}
            onFile={(file) => void importing.run(file).catch(() => {})}
          />
        </div>
        {imported && (
          <p role="status" className="text-sm text-brand-700 dark:text-brand-500">
            {imported}
          </p>
        )}
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">How do you train?</legend>
        {modes.map((m) => (
          <label
            key={m.value}
            className={`card flex cursor-pointer items-start gap-3 p-3 transition ${
              mode === m.value ? 'border-brand-600 ring-2 ring-brand-500/30' : ''
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="mt-1 accent-brand-600"
            />
            <span>
              <span className="block font-medium">{m.title}</span>
              <span className="block text-sm text-neutral-500">{m.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Rest between sets</legend>
        <div className="flex gap-2">
          {REST_OPTIONS.map((seconds) => (
            <button
              key={seconds ?? 'off'}
              type="button"
              aria-pressed={rest === seconds}
              onClick={() => setRest(seconds)}
              className={`chip flex-1 justify-center ${rest === seconds ? 'chip-active' : ''}`}
            >
              {seconds === null
                ? 'No timer'
                : seconds < 120
                  ? `${seconds}s`
                  : `${seconds / 60} min`}
            </button>
          ))}
        </div>
        <p className="text-sm text-neutral-500">
          {rest === null
            ? 'No countdown or alerts. You can switch the timer on later in Settings.'
            : 'You can nudge it ±15s on the timer any time.'}
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm whitespace-pre-line text-red-600">
          {error.message}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary mt-auto py-3 text-base"
        disabled={!mode || busy}
        onClick={() => void finishing.run().catch(() => {})}
      >
        {finishing.isPending ? 'Laying tracks…' : 'All aboard! 🚂'}
      </button>
    </main>
  )
}
