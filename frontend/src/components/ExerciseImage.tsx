/** An exercise photo, or a lettered placeholder (custom exercises have no images). */
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
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-16 w-16 shrink-0 rounded-lg bg-neutral-200 object-cover dark:bg-neutral-800"
    />
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
