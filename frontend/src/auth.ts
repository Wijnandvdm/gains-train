import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, unwrap } from './api/client'
import type { UserOut } from './api/schema'

export const meQueryKey = ['me'] as const

/** The signed-in user; null when signed out, undefined while still checking. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<UserOut | null> => {
      try {
        return await unwrap(api.GET('/api/me'))
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity, // only changes on sign-in/out, which update it directly
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/auth/logout')),
    onSuccess: () => {
      // Stop Google One Tap from silently signing straight back in.
      window.google?.accounts.id.disableAutoSelect()
      queryClient.clear()
      queryClient.setQueryData(meQueryKey, null)
    },
  })
}

/**
 * Only allow redirects to paths inside this app after login. Otherwise a crafted link
 * like /login?next=https://evil.example could bounce a freshly signed-in user elsewhere.
 */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/'
  }
  return next
}
