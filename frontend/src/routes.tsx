import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { Spinner } from './components/Spinner'
import { ExerciseDetailPage } from './pages/ExerciseDetailPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { HistoryPage } from './pages/HistoryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProgressPage } from './pages/ProgressPage'
import { WorkoutDetailPage } from './pages/WorkoutDetailPage'
import { WorkoutPage } from './pages/WorkoutPage'

// Screens you rarely open (setup, settings, the routine editor) load when first opened, so the
// app starts with just the everyday screens.
const lazyPage = {
  setup: async () => ({ Component: (await import('./pages/SetupPage')).SetupPage }),
  routine: async () => ({ Component: (await import('./pages/RoutinePage')).RoutinePage }),
  settings: async () => ({ Component: (await import('./pages/SettingsPage')).SettingsPage }),
}

export const routes: RouteObject[] = [
  { path: '/setup', lazy: lazyPage.setup, hydrateFallbackElement: <Spinner /> },
  {
    element: <AppLayout />,
    hydrateFallbackElement: <Spinner />,
    children: [
      { index: true, element: <Navigate to="/workout" replace /> },
      { path: 'workout', element: <WorkoutPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'history/:workoutId', element: <WorkoutDetailPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'exercises/:exerciseId', element: <ExerciseDetailPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'routine', lazy: lazyPage.routine },
      { path: 'settings', lazy: lazyPage.settings },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
