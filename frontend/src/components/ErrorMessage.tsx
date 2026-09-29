/** An error to show under a form or button (nothing when there is none). Line breaks in the
 *  message are kept, e.g. an import that lists several unknown exercise names. */
export function ErrorMessage({
  error,
  prefix,
  className = '',
}: {
  error: Error | null | undefined
  /** e.g. "Couldn't save:" */
  prefix?: string
  className?: string
}) {
  if (!error) return null
  return (
    <p role="alert" className={`text-sm whitespace-pre-line text-red-600 ${className}`}>
      {prefix && `${prefix} `}
      {error.message}
    </p>
  )
}
