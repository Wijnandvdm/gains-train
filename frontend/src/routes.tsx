import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { ComingSoonPage, NotFoundPage } from './pages/ComingSoonPage'
import { ExerciseDetailPage } from './pages/ExerciseDetailPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { WorkoutDetailPage } from './pages/WorkoutDetailPage'
import { WorkoutPage } from './pages/WorkoutPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/workout" replace /> },
          { path: 'workout', element: <WorkoutPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'history/:workoutId', element: <WorkoutDetailPage /> },
          { path: 'exercises', element: <ExercisesPage /> },
          { path: 'exercises/:exerciseId', element: <ExerciseDetailPage /> },
          {
            path: 'progress',
            element: (
              <ComingSoonPage
                title="Progress"
                description="Charts per exercise and your personal records. Coming soon."
              />
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
