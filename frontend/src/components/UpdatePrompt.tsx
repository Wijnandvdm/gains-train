import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

/** Offers to switch to a new version of the app once it has been downloaded. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app can stay open for days: check for a new version every hour.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), HOUR)
    },
  })

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-2 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-neutral-900 py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      New version available
      <button
        type="button"
        className="rounded-full bg-brand-600 px-3 py-1 font-medium text-white"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </button>
      <button
        type="button"
        aria-label="Later"
        className="px-1 text-neutral-400"
        onClick={() => setNeedRefresh(false)}
      >
        ✕
      </button>
    </div>
  )
}
