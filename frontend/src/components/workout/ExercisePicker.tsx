import { useEffect, useRef, useState } from 'react'
import type { ExerciseSummary } from '../../data/types'
import { useExerciseSearch } from '../../exercises'
import { usePaged } from '../../lib/usePaged'
import { ExerciseThumb } from '../ExerciseImage'
import { SearchIcon } from '../icons'
import { Spinner } from '../Spinner'

/** Full-screen sheet to search for an exercise and add it to the workout. */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: ExerciseSummary) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const results = useExerciseSearch({ q: query || undefined })
  const { visible: exercises, hasMore, showMore } = usePaged(results.data)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add exercise"
      className="fixed inset-0 z-30 flex flex-col bg-neutral-50 dark:bg-neutral-950"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-hidden p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-0">
        <div className="flex items-center gap-2">
          <label className="relative block flex-1">
            <span className="sr-only">Search exercises</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search exercises"
              className="input pl-10"
              enterKeyHint="search"
              autoComplete="off"
            />
          </label>
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
        </div>

        <div className="-mx-4 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {results.isPending ? (
            <Spinner />
          ) : results.isError ? (
            <p className="py-8 text-center text-neutral-500">
              Couldn't load the exercise library.{' '}
              <button type="button" className="underline" onClick={results.retry}>
                Try again
              </button>
            </p>
          ) : exercises.length === 0 ? (
            <p className="py-8 text-center text-neutral-500">No exercises found.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {exercises.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => onPick(exercise)}
                    className="card flex w-full items-center gap-3 p-2 text-left transition hover:border-brand-500"
                  >
                    <ExerciseThumb name={exercise.name} src={exercise.image_urls[0]} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{exercise.name}</span>
                      <span className="block truncate text-sm text-neutral-500 capitalize">
                        {[exercise.primary_muscles.join(', '), exercise.equipment]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {hasMore && (
                <li className="flex justify-center">
                  <button type="button" className="btn" onClick={showMore}>
                    Load more
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
