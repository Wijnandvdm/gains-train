import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'
import { meQueryKey } from './auth'

/** Shared by the app and the tests, so both behave the same. */
export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // Session expired or revoked: mark as signed out, so RequireAuth redirects to /login.
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          queryClient.setQueryData(meQueryKey, null)
        }
      },
    }),
    defaultOptions: {
      queries: {
        // Always run the request, even when the phone says it's offline: the service
        // worker may answer from its cache. (The default would just pause the query.)
        networkMode: 'offlineFirst',
        // Don't retry client errors (e.g. 404); do retry network hiccups and 5xx twice.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  })
  return queryClient
}
