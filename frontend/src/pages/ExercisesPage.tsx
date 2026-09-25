import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ExerciseSummary } from '../api/schema'
import { ExerciseThumb } from '../components/ExerciseImage'
import { SearchIcon } from '../components/icons'
import { Spinner } from '../components/Spinner'
import { type ExerciseSearch, useExerciseFilters, useExerciseSearch } from '../exercises'

export function ExercisesPage() {
  // The URL is the source of truth for filters, so back/forward and reloads keep them.
  const [params, setParams] = useSearchParams()
  const search: ExerciseSearch = {
    q: params.get('q') ?? undefined,
    muscle: params.get('muscle') ?? undefined,
    equipment: params.get('equipment') ?? undefined,
  }

  function setParam(key: keyof ExerciseSearch, value: string | undefined) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  // The text box updates instantly; the URL (and so the request) only once typing pauses.
  const [text, setText] = useState(search.q ?? '')
  const searchTimer = useRef<number | undefined>(undefined)
  function onSearchChange(value: string) {
    setText(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setParam('q', value.trim() || undefined), 250)
  }
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const filters = useExerciseFilters()
  const results = useExerciseSearch(search)
  const exercises = results.data?.pages.flatMap((page) => page.items) ?? []
  const total = results.data?.pages[0]?.total

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Exercises</h1>

      <label className="relative block">
        <span className="sr-only">Search exercises</span>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={text}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search, e.g. “incline curl”"
          className="input pl-10"
          enterKeyHint="search"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-col gap-2">
        {/* Muscles: a horizontally scrolling row of chips (thumb-friendly on phones). */}
        <div
          role="group"
          aria-label="Filter by muscle"
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4"
        >
          <FilterChip active={!search.muscle} onClick={() => setParam('muscle', undefined)}>
            All muscles
          </FilterChip>
          {filters.data?.muscles.map((muscle) => (
            <FilterChip
              key={muscle}
              active={search.muscle === muscle}
              onClick={() => setParam('muscle', search.muscle === muscle ? undefined : muscle)}
            >
              {muscle}
            </FilterChip>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">Equipment</span>
            <select
              value={search.equipment ?? ''}
              onChange={(e) => setParam('equipment', e.target.value || undefined)}
              className="input w-auto py-1 text-base capitalize"
            >
              <option value="">Any</option>
              {filters.data?.equipment.map((equipment) => (
                <option key={equipment} value={equipment}>
                  {equipment}
                </option>
              ))}
            </select>
          </label>
          {total !== undefined && (
            <span className="text-sm text-neutral-500" aria-live="polite">
              {total} {total === 1 ? 'exercise' : 'exercises'}
            </span>
          )}
        </div>
      </div>

      {results.isPending ? (
        <Spinner />
      ) : results.isError ? (
        <div className="py-8 text-center">
          <p className="mb-3">Couldn't load exercises.</p>
          <button className="btn" onClick={() => results.refetch()}>
            Try again
          </button>
        </div>
      ) : exercises.length === 0 ? (
        <p className="py-8 text-center text-neutral-500">No exercises match these filters.</p>
      ) : (
        // Dim stale results while a new search is loading.
        <ul
          className={`flex flex-col gap-2 transition-opacity ${results.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseCard exercise={exercise} />
            </li>
          ))}
        </ul>
      )}

      {results.hasNextPage && (
        <LoadMore onLoad={() => results.fetchNextPage()} loading={results.isFetchingNextPage} />
      )}
    </section>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`chip ${active ? 'chip-active' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
    >
      {children}
    </button>
  )
}

function ExerciseCard({ exercise }: { exercise: ExerciseSummary }) {
  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="card flex items-center gap-3 p-2 transition hover:border-brand-500"
    >
      <ExerciseThumb name={exercise.name} src={exercise.image_urls[0]} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{exercise.name}</p>
        <p className="truncate text-sm text-neutral-500 capitalize">
          {exercise.primary_muscles.join(', ') || '—'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pr-1 text-xs">
        {exercise.is_custom && (
          <span className="rounded bg-brand-100 px-1.5 py-0.5 font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-100">
            Custom
          </span>
        )}
        {exercise.equipment && (
          <span className="text-neutral-500 capitalize">{exercise.equipment}</span>
        )}
      </div>
    </Link>
  )
}

/** Loads the next page when scrolled into view; also a plain button as a fallback. */
function LoadMore({ onLoad, loading }: { onLoad: () => void; loading: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  // Always calls the latest onLoad, without re-creating the observer when it changes.
  const onVisible = useEffectEvent(onLoad)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onVisible(),
      { rootMargin: '400px' }, // start loading before the user reaches the end
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <button ref={ref} className="btn mx-auto" onClick={onLoad} disabled={loading}>
      {loading ? 'Loading…' : 'Load more'}
    </button>
  )
}
