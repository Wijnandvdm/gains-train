// Temporary page to test sign-in end to end. Step 5 replaces it with the real app shell.
import { useEffect, useRef, useState } from 'react'

type User = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
}

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve()
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(script)
  })
}

function GoogleButton({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function setup() {
      const config = (await (await fetch('/api/auth/config')).json()) as {
        google_client_id: string
      }
      await loadGoogleScript()
      if (cancelled || !buttonRef.current) return
      google.accounts.id.initialize({
        client_id: config.google_client_id,
        // Google calls this with a signed ID token; the backend verifies it and sets our cookie.
        callback: async ({ credential }) => {
          const r = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
          })
          if (r.ok) onSignedIn((await r.json()) as User)
          else setError(((await r.json()) as { detail: string }).detail)
        },
      })
      google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
      })
    }
    setup().catch((e: Error) => setError(e.message))
    return () => {
      cancelled = true
    }
  }, [onSignedIn])

  return (
    <div>
      <div ref={buttonRef} />
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  )
}

function App() {
  // undefined: still checking the session; null: signed out
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? (r.json() as Promise<User>) : null))
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    // Only loaded if the sign-in button was shown during this visit.
    window.google?.accounts.id.disableAutoSelect()
    setUser(null)
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-3xl font-bold">gains-train</h1>
      {user === undefined && <p className="text-gray-500">Loading…</p>}
      {user === null && <GoogleButton onSignedIn={setUser} />}
      {user && (
        <div className="flex items-center gap-4">
          {user.avatar_url && (
            <img
              src={user.avatar_url}
              alt=""
              className="h-12 w-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="flex-1">
            <p className="font-semibold">{user.name ?? user.email}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      )}
    </main>
  )
}

export default App
