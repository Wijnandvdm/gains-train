import { useCallback, useState } from 'react'

/** Run an async action from a button: tracks "busy" and the last error for the UI. */
export function useAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const run = useCallback(
    async (...args: Args): Promise<Result> => {
      setPending(true)
      setError(null)
      try {
        return await action(...args)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
        throw e
      } finally {
        setPending(false)
      }
    },
    [action],
  )
  return { run, isPending, error }
}
