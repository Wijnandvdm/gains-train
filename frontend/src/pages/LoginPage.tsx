import { useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { meQueryKey, safeNext, useMe } from '../auth'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { TrainIcon } from '../components/icons'
import { TAGLINE } from '../copy'
import { Spinner } from '../components/Spinner'

export function LoginPage() {
  const { data: user, isPending } = useMe()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const next = safeNext(params.get('next'))

  if (isPending) return <Spinner fullScreen />
  if (user) return <Navigate to={next} replace />

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-brand-600 p-3 text-white">
          <TrainIcon className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">gains-train</h1>
        <p className="text-lg font-medium">{TAGLINE}</p>
        <p className="text-neutral-500">Log your lifts. Next stop: PR city. 🚂</p>
      </div>
      <GoogleSignInButton
        onSignedIn={(signedIn) => {
          queryClient.setQueryData(meQueryKey, signedIn)
          navigate(next, { replace: true })
        }}
      />
    </main>
  )
}
