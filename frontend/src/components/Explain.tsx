// An icon that explains itself when tapped: a small bubble with what it means here. Tapping
// anywhere else (or Escape) closes it. Instead of legends, so screens stay calm.
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

export function Explain({
  text,
  more,
  align = 'left',
  children,
}: {
  text: string
  /** Something to do about it, under the text (e.g. a link to the setting). */
  more?: ReactNode
  /** Which edge the bubble lines up with: 'right' near the right edge of the screen. */
  align?: 'left' | 'right'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        className="rounded-full"
      >
        {children}
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={`absolute top-full z-20 mt-1.5 w-60 rounded-lg bg-neutral-900 px-3 py-2 text-left text-xs leading-snug font-normal text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {text}
          {more && <span className="mt-1.5 block">{more}</span>}
        </span>
      )}
    </span>
  )
}
