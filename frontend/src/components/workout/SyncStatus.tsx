import { useOutboxStatus } from '../../workout/hooks'

/** "Saved" / "Saving…" / "Offline · 3 waiting": whether logged sets have reached the server. */
export function SyncStatus() {
  const { pending, state } = useOutboxStatus()

  const [dot, text] =
    state === 'offline'
      ? ['bg-amber-500', `Offline · ${pending} waiting`]
      : state === 'paused'
        ? ['bg-red-500', `Sign in to sync · ${pending} waiting`]
        : pending > 0
          ? ['bg-neutral-400 animate-pulse', 'Saving…']
          : ['bg-brand-500', 'Saved']

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  )
}

/** A change the server rejected (after retrying wouldn't help). */
export function SyncError() {
  const { error } = useOutboxStatus()
  if (!error) return null
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
    >
      {error}
    </p>
  )
}
