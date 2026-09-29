import { type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackupFileHint } from '../components/BackupFileHint'
import { FilePicker } from '../components/FilePicker'
import { DepotControls } from '../components/GainsLine'
import { DepotIcon } from '../components/icons'
import { saveFile } from '../lib/saveFile'
import { backupFileName, createBackup, readBackupFile, restoreBackup } from '../data/backup'
import { WEEKLY_TARGETS } from '../data/line'
import { DEFAULT_SETTINGS } from '../data/db'
import { formatClock, plural } from '../lib/format'
import { REST_CHOICES } from '../lib/rest'
import { useGainsLine } from '../line'
import { useAction } from '../lib/useAction'
import { updateSettings, useSettings } from '../settings'
import { ErrorMessage } from '../components/ErrorMessage'

export function SettingsPage() {
  const settings = useSettings()
  const line = useGainsLine()
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card title="Rest timer">
        <Switch
          label="Start a rest timer after each set"
          checked={settings?.rest_timer_enabled ?? DEFAULT_SETTINGS.rest_timer_enabled}
          onChange={(on) => void updateSettings({ rest_timer_enabled: on })}
        />
        <label className="flex items-center justify-between gap-3 text-sm">
          Default rest (when an exercise has no smart default)
          <select
            value={settings?.default_rest_seconds ?? DEFAULT_SETTINGS.default_rest_seconds}
            onChange={(e) => void updateSettings({ default_rest_seconds: Number(e.target.value) })}
            className="input w-auto py-1 text-base"
          >
            {REST_CHOICES.map((s) => (
              <option key={s} value={s}>
                {formatClock(s)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-neutral-500">
          Per-exercise rest times are set on each exercise's card during a workout.
        </p>
      </Card>

      <Card title="The Gains Line">
        <label className="flex items-center justify-between gap-3 text-sm">
          Rides per week to reach a station
          <select
            value={settings?.weekly_target ?? DEFAULT_SETTINGS.weekly_target}
            onChange={(e) => void updateSettings({ weekly_target: Number(e.target.value) })}
            className="input w-auto py-1 text-base"
          >
            {WEEKLY_TARGETS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-neutral-500">
          Every week with this many rides is a station; stations in a row are your streak. You earn
          a ticket for every 4 stations in a row and for every extra ride, and a ticket saves your
          streak when a week falls short. Changing the number recalculates your whole line.
        </p>
        {line && (
          <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <DepotIcon className="h-4 w-4" />
              The depot
            </h3>
            <DepotControls line={line} />
          </div>
        )}
      </Card>

      <Card title="Routine">
        <Link to="/routine" className="btn">
          Edit routine
        </Link>
      </Card>

      <BackupCard />
      <StorageCard />
      <AboutCard />
    </section>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left text-sm"
    >
      {label}
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${checked ? 'left-5.5' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

function BackupCard() {
  const [message, setMessage] = useState<string | null>(null)
  const exporting = useAction(async () => {
    const backup = await createBackup()
    await saveFile(backupFileName(), JSON.stringify(backup), 'application/json')
    setMessage(`Backup made: ${plural(backup.workouts.length, 'workout')}.`)
  })
  const restoring = useAction(async (file: File) => {
    const backup = await readBackupFile(file)
    if (!window.confirm('Replace everything on this phone with this backup?')) return
    await restoreBackup(backup)
    setMessage(
      `Restored ${plural(backup.workouts.length, 'workout')} from ${backup.exported_at.slice(0, 10)}.`,
    )
  })
  const error = exporting.error ?? restoring.error

  return (
    <Card title="Backup">
      <p className="text-sm text-neutral-500">
        Your data only lives on this phone. Export a backup now and then, and keep the file
        somewhere safe (e.g. Google Drive). The same file restores everything on a new phone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={exporting.isPending}
          onClick={() => void exporting.run().catch(() => {})}
        >
          Export backup
        </button>
        <FilePicker
          label="Import backup"
          accept="application/json,.json"
          disabled={restoring.isPending}
          onFile={(file) => void restoring.run(file).catch(() => {})}
        />
      </div>
      <BackupFileHint />
      {message && (
        <p role="status" className="text-sm text-brand-700 dark:text-brand-500">
          {message}
        </p>
      )}
      <ErrorMessage error={error} />
    </Card>
  )
}

function StorageCard() {
  return (
    <Card title="Storage">
      <p className="text-sm text-neutral-500">
        Your data stays in the app until you uninstall it (or clear its storage), so export a backup
        before you do.
      </p>
    </Card>
  )
}

/** Credits, as the drawings' licence (CC BY-SA 4.0) asks. */
function AboutCard() {
  const link = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline">
      {text}
    </a>
  )
  return (
    <Card title="About">
      <p className="text-sm text-neutral-500">
        Exercise drawings: {link('https://github.com/bryllim/workout-guide', 'Workout Guide')} by
        Bryl Lim, based on {link('https://github.com/everkinetic/data', 'Everkinetic')}, under{' '}
        {link('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0')}; recoloured to fit
        the app's theme. Exercise instructions:{' '}
        {link('https://github.com/yuhonas/free-exercise-db', 'free-exercise-db')} (public domain)
        and our own.
      </p>
    </Card>
  )
}
