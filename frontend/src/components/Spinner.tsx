export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const spinner = (
    <div
      role="status"
      aria-label="Loading"
      className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-brand-600 dark:border-neutral-700 dark:border-t-brand-500"
    />
  )
  if (!fullScreen) return <div className="flex justify-center p-6">{spinner}</div>
  return <div className="flex min-h-dvh items-center justify-center">{spinner}</div>
}
