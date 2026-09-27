import type { CSSProperties } from 'react'

/**
 * An exercise drawing (a single-colour line drawing, see scripts/build-exercises.mjs), drawn
 * in the current text colour so it suits light and dark mode. Fills its box; `className` sets
 * size and position.
 */
export function Drawing({ src, className = '' }: { src: string; className?: string }) {
  const mask = `url("${src}") center / contain no-repeat`
  const style: CSSProperties = { mask, WebkitMask: mask }
  return <span aria-hidden="true" className={`block bg-current ${className}`} style={style} />
}

/** An exercise's drawing, or a lettered placeholder (custom exercises have no drawing). */
export function ExerciseThumb({ name, src }: { name: string; src?: string }) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100"
      >
        {initials(name)}
      </div>
    )
  }
  return (
    <div className="relative h-16 w-16 shrink-0 rounded-lg bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
      <Drawing src={src} className="absolute inset-1" />
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}
