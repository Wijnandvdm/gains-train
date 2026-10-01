import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../settings'
import { ChartIcon, DumbbellIcon, GearIcon, HistoryIcon, ListIcon, TrainIcon } from './icons'

const TABS = [
  { to: '/workout', label: 'Workout', icon: DumbbellIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/exercises', label: 'Exercises', icon: ListIcon },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
]

export function AppLayout() {
  const settings = useSettings()
  // First open: ask the setup questions before anything else.
  if (settings && !settings.setup_completed_at) return <Navigate to="/setup" replace />
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-neutral-50/90 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <Link to="/workout" className="flex items-center gap-1.5 font-bold tracking-tight">
          <TrainIcon className="h-6 w-6 text-brand-600 dark:text-brand-500" />
          Gains Train
        </Link>
        <Link
          to="/settings"
          aria-label="Settings"
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <GearIcon />
        </Link>
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
