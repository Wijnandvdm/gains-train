import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrainIcon } from '../components/icons'
import { useCompleteSetup, useRoutineFromHistory } from '../routine'
import { useWorkoutHistory } from '../workout/hooks'
import { recentRoutines } from '../workout/recent'
import { DEFAULT_REST_SECONDS } from '../lib/rest'

type Mode = 'split' | 'build' | 'free'
const REST_OPTIONS = [60, 90, 120, 180]

/** The first-open questions: how you train, and how long you rest. */
export function SetupPage() {
  const navigate = useNavigate()
  const history = useWorkoutHistory()
  const split = recentRoutines(history.data?.pages.flatMap((p) => p.items) ?? [], 14)
  const fromHistory = useRoutineFromHistory()
  const completeSetup = useCompleteSetup()

  const [mode, setMode] = useState<Mode | null>(null)
  const [rest, setRest] = useState(DEFAULT_REST_SECONDS)
  const saving = fromHistory.isPending || completeSetup.isPending
  const error = fromHistory.error ?? completeSetup.error

  async function finish() {
    if (mode === 'split') await fromHistory.mutateAsync(undefined)
    await completeSetup.mutateAsync(rest)
    navigate(mode === 'build' ? '/routine' : '/workout', { replace: true })
  }

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-[calc(2rem+env(safe-area-inset-top))]">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-brand-600 p-3 text-white">
          <TrainIcon className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold">Let's lay the tracks</h1>
        <p className="text-neutral-500">
          Two questions, then every workout is one tap per set. Choo choo.
        </p>
      </header>

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
              key={seconds}
              type="button"
              aria-pressed={rest === seconds}
              onClick={() => setRest(seconds)}
              className={`chip flex-1 justify-center ${rest === seconds ? 'chip-active' : ''}`}
            >
              {seconds < 120 ? `${seconds}s` : `${seconds / 60} min`}
            </button>
          ))}
        </div>
        <p className="text-sm text-neutral-500">You can nudge it ±15s on the timer any time.</p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          Couldn't save: {error.message}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary mt-auto py-3 text-base"
        disabled={!mode || saving}
        onClick={() => void finish()}
      >
        {saving ? 'Laying tracks…' : 'All aboard! 🚂'}
      </button>
    </main>
  )
}
