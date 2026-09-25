import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { ExerciseDetail } from '../api/schema'
import { ExerciseProgress } from '../components/ExerciseProgress'
import { BackIcon } from '../components/icons'
import { MuscleMap } from '../components/MuscleMap'
import { Spinner } from '../components/Spinner'
import { useExercise } from '../exercises'

export function ExerciseDetailPage() {
  const id = Number(useParams().exerciseId)
  const { data: exercise, isPending, error, refetch } = useExercise(id)

  return (
    <section className="flex flex-col gap-4">
      <BackButton />
      {isPending ? (
        <Spinner />
      ) : error instanceof ApiError && error.status === 404 ? (
        <NotFound />
      ) : error ? (
        <div className="py-8 text-center">
          <p className="mb-3">Couldn't load this exercise.</p>
          <button className="btn" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <Exercise exercise={exercise} />
      )}
    </section>
  )
}

/** Goes back (keeping search + scroll position), or to the list when opened directly. */
function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasHistory = location.key !== 'default'
  return (
    <button
      type="button"
      onClick={() => (hasHistory ? navigate(-1) : navigate('/exercises'))}
      className="-ml-2 flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      <BackIcon />
      Exercises
    </button>
  )
}

function NotFound() {
  return (
    <div className="py-8 text-center">
      <p className="mb-3">This exercise doesn't exist.</p>
      <Link to="/exercises" className="btn">
        Browse exercises
      </Link>
    </div>
  )
}

function Exercise({ exercise }: { exercise: ExerciseDetail }) {
  const details = [exercise.level, exercise.equipment, exercise.mechanic, exercise.force].filter(
    (d): d is string => Boolean(d),
  )

  return (
    <article className="flex flex-col gap-5">
      {exercise.image_urls.length > 0 && <MotionImages urls={exercise.image_urls} />}

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{exercise.name}</h1>
        <ul className="flex flex-wrap gap-1.5" aria-label="Details">
          {exercise.is_custom && (
            <li className="rounded bg-brand-100 px-2 py-0.5 text-sm font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-100">
              Custom
            </li>
          )}
          {details.map((detail) => (
            <li
              key={detail}
              className="rounded bg-neutral-200 px-2 py-0.5 text-sm capitalize dark:bg-neutral-800"
            >
              {detail}
            </li>
          ))}
        </ul>
      </header>

      <MusclesWorked primary={exercise.primary_muscles} secondary={exercise.secondary_muscles} />

      <ExerciseProgress exerciseId={exercise.id} />

      {exercise.instructions.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">How to</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-neutral-700 marker:text-neutral-400 dark:text-neutral-300">
            {exercise.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}

function MusclesWorked({ primary, secondary }: { primary: string[]; secondary: string[] }) {
  if (primary.length + secondary.length === 0) return null
  const chip = (muscle: string, isPrimary: boolean) => (
    <li key={muscle}>
      <Link
        to={`/exercises?muscle=${encodeURIComponent(muscle)}`}
        className={`chip ${isPrimary ? 'chip-active' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
      >
        {muscle}
      </Link>
    </li>
  )
  return (
    <section aria-labelledby="muscles-heading">
      <h2 id="muscles-heading" className="mb-2 font-semibold">
        Muscles worked
      </h2>
      <div className="flex items-center gap-4">
        <MuscleMap primary={primary} secondary={secondary} />
        <div className="flex min-w-0 flex-col gap-2">
          <ul className="flex flex-wrap gap-2" aria-label="Primary muscles">
            {primary.map((m) => chip(m, true))}
          </ul>
          {secondary.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Secondary muscles">
              {secondary.map((m) => chip(m, false))}
            </ul>
          )}
          <p className="flex gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: 'var(--map-primary)' }}
              />
              primary
            </span>
            {secondary.length > 0 && (
              <span className="flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: 'var(--map-secondary)' }}
                />
                secondary
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * The dataset has a start and an end position photo per exercise. Alternating them reads
 * like a slow animation. With reduced motion enabled it waits for a tap instead.
 */
function MotionImages({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0)
  const [autoplay] = useState(() => !prefersReducedMotion())

  useEffect(() => {
    if (!autoplay || urls.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % urls.length), 1200)
    return () => clearInterval(timer)
  }, [autoplay, urls.length])

  return (
    <button
      type="button"
      onClick={() => setIndex((i) => (i + 1) % urls.length)}
      className="relative -mx-4 aspect-[4/3] overflow-hidden bg-neutral-200 sm:mx-0 sm:rounded-xl dark:bg-neutral-800"
      aria-label={`Show position ${((index + 1) % urls.length) + 1} of ${urls.length}`}
    >
      {/* All images stay mounted (preloaded); only opacity changes, so there's no flicker. */}
      {urls.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </button>
  )
}
