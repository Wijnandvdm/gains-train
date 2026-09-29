import { useRef } from 'react'

/** A button that opens the file picker and hands over the chosen file. */
export function FilePicker({
  label,
  accept,
  disabled,
  className = 'btn',
  onFile,
}: {
  label: string
  accept: string
  disabled?: boolean
  className?: string
  onFile: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // picking the same file again should work too
          if (file) onFile(file)
        }}
      />
    </>
  )
}
