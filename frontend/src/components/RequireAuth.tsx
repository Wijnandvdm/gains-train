import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useMe } from '../auth'
import { Spinner } from './Spinner'

/** Route guard: renders child routes when signed in, otherwise redirects to /login. */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useMe()
  const location = useLocation()

  if (isPending) return <Spinner fullScreen />
  if (isError) {
    return (
      <div className="p-6 text-center">
        <p className="mb-3">Can't reach the server.</p>
        <button className="btn" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    )
  }
  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}
