import type { CSSProperties } from 'react'
import type { ExerciseSummary } from '../data/types'
import { MuscleMap } from './MuscleMap'

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

type ThumbExercise = Pick<
  ExerciseSummary,
  'name' | 'image_urls' | 'primary_muscles' | 'secondary_muscles'
>

/**
 * An exercise's drawing. Without one (some library exercises, and your own): its muscles, front
 * and back; and without those either, its initials.
 */
export function ExerciseThumb({ exercise }: { exercise: ThumbExercise }) {
  const [src] = exercise.image_urls
  if (!src && exercise.primary_muscles.length > 0) {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800"
      >
        <MuscleMap
          primary={exercise.primary_muscles}
          secondary={exercise.secondary_muscles}
          width={28}
        />
      </div>
    )
  }
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-train-100 text-lg font-bold text-train-700 dark:bg-train-900 dark:text-train-100"
      >
        {initials(exercise.name)}
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
