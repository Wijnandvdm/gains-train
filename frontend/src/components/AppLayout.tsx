import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useMe, useSignOut } from '../auth'
import { useOutboxSync } from '../workout/hooks'
import { outbox } from '../workout/sync'
import { ChartIcon, DumbbellIcon, HistoryIcon, ListIcon } from './icons'

const TABS = [
  { to: '/workout', label: 'Workout', icon: DumbbellIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/exercises', label: 'Exercises', icon: ListIcon },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
]

function AccountMenu() {
  const { data: user } = useMe()
  const signOut = useSignOut()
  if (!user) return null

  return (
    <details className="relative">
      <summary className="list-none rounded-full [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Account</span>
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 cursor-pointer rounded-full"
          />
        ) : (
          <span className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand-600 font-semibold text-white uppercase">
            {(user.name ?? user.email)[0]}
          </span>
        )}
      </summary>
      <div className="card absolute right-0 z-20 mt-2 w-60 p-3 shadow-lg">
        <p className="truncate font-medium">{user.name ?? user.email}</p>
        <p className="truncate text-sm text-neutral-500">{user.email}</p>
        <Link to="/routine" className="btn mt-3 w-full">
          Edit routine
        </Link>
        <button
          className="btn mt-2 w-full"
          onClick={() => {
            const { pending } = outbox.getStatus()
            const lose = `${pending} change${pending === 1 ? " hasn't" : "s haven't"} synced yet and will be lost. Sign out anyway?`
            if (pending > 0 && !window.confirm(lose)) return
            outbox.clear()
            signOut.mutate()
          }}
          disabled={signOut.isPending}
        >
          Sign out
        </button>
      </div>
    </details>
  )
}

export function AppLayout() {
  useOutboxSync()
  const { data: user } = useMe()
  // First open: ask the setup questions before anything else.
  if (user && !user.setup_completed_at) return <Navigate to="/setup" replace />
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-neutral-50/90 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <span className="font-bold tracking-tight">gains-train</span>
        <AccountMenu />
      </header>

      {/* Bottom padding keeps content clear of the tab bar (and the iPhone home indicator). */}
      <main className="flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, label, icon: TabIcon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-500'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`
                }
              >
                <TabIcon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
