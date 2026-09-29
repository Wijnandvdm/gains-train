import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ExerciseDetailPage } from './pages/ExerciseDetailPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { HistoryPage } from './pages/HistoryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProgressPage } from './pages/ProgressPage'
import { RoutinePage } from './pages/RoutinePage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { WorkoutDetailPage } from './pages/WorkoutDetailPage'
import { WorkoutPage } from './pages/WorkoutPage'

export const routes: RouteObject[] = [
  { path: '/setup', element: <SetupPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/workout" replace /> },
      { path: 'workout', element: <WorkoutPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'history/:workoutId', element: <WorkoutDetailPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'exercises/:exerciseId', element: <ExerciseDetailPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'routine', element: <RoutinePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
