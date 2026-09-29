import { useState } from 'react'

const key = (workoutId: string) => `gains-train:skipped:${workoutId}`

/** Exercises skipped in the focus card during this workout (kept across reloads). */
export function useSkipped(workoutId: string): [ReadonlySet<string>, (itemKey: string) => void] {
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key(workoutId)) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  function skip(itemKey: string) {
    const next = new Set(skipped).add(itemKey)
    setSkipped(next)
    try {
      localStorage.setItem(key(workoutId), JSON.stringify([...next]))
    } catch {
      // Storage unavailable: the skip still holds until the page reloads.
    }
  }
  return [skipped, skip]
}
