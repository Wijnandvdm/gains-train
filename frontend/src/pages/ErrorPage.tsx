// When a screen crashes: what happened, that your data is safe, and a way out. Instead of
// React Router's developer message. The error text is folded away, to pass on.
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ERRORS } from '../copy'

export function ErrorPage() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n\n${error.stack}` : ''}`
      : String(error)
  console.error(error)

  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold">{ERRORS.title}</h1>
      <p className="text-neutral-600 dark:text-neutral-300">
        This screen hit an error. Your workouts are safe: everything is saved on your phone as you
        go.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
        {/* A full page load, so the app starts fresh. */}
        <a href="/workout" className="btn">
          Go to Workout
        </a>
      </div>
      <details className="w-full text-left text-sm text-neutral-500">
        <summary className="cursor-pointer text-center">Details (to pass on)</summary>
        <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-neutral-100 p-2 text-xs whitespace-pre-wrap dark:bg-neutral-800">
          {detail}
        </pre>
      </details>
    </section>
  )
}
