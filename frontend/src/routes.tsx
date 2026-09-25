import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { ComingSoonPage, NotFoundPage } from './pages/ComingSoonPage'
import { ExerciseDetailPage } from './pages/ExerciseDetailPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { LoginPage } from './pages/LoginPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Until live workouts exist (step 7), the exercise library is home.
          { index: true, element: <Navigate to="/exercises" replace /> },
          { path: 'exercises', element: <ExercisesPage /> },
          { path: 'exercises/:exerciseId', element: <ExerciseDetailPage /> },
          {
            path: 'workout',
            element: (
              <ComingSoonPage
                title="Workout"
                description="Start a session, log your sets and get a rest timer. Coming soon."
              />
            ),
          },
          {
            path: 'history',
            element: (
              <ComingSoonPage
                title="History"
                description="All your past workouts, including the ones imported from your sheet. Coming soon."
              />
            ),
          },
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
