import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { api, ApiError, unwrap } from '../api/client'
import type { UserOut } from '../api/schema'

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | undefined

function loadGoogleScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = undefined // allow a retry
      reject(new Error('Could not load Google sign-in. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Google's own sign-in button. Google hands us a signed ID token, which the backend
 * verifies before setting our session cookie.
 */
export function GoogleSignInButton({ onSignedIn }: { onSignedIn: (user: UserOut) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  // Always calls the latest onSignedIn, without re-initialising Google when it changes.
  const signedIn = useEffectEvent(onSignedIn)

  useEffect(() => {
    let cancelled = false

    async function setup() {
      const [{ google_client_id }] = await Promise.all([
        unwrap(api.GET('/api/auth/config')),
        loadGoogleScript(),
      ])
      if (cancelled || !containerRef.current) return
      if (!google_client_id) throw new Error('Sign-in is not configured on the server.')

      google.accounts.id.initialize({
        client_id: google_client_id,
        callback: async ({ credential }) => {
          setError(null)
          try {
            const user = await unwrap(api.POST('/api/auth/google', { body: { credential } }))
            signedIn(user)
          } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Sign-in failed. Please try again.')
          }
        },
      })
      google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
      })
    }

    setup().catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={containerRef} className="min-h-11" />
      {error && (
        <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
