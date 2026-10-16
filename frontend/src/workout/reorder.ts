/** The list with the item at `from` moved to `to` (the others shift around it). */
export function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/**
 * Whether today's exercise order differs from the routine day's, for the exercises both have
 * (so moving an extra exercise around doesn't ask to change the routine).
 */
export function orderDiffers(dayExerciseIds: string[], workoutExerciseIds: string[]): boolean {
  const routine = dayExerciseIds.filter((id) => workoutExerciseIds.includes(id))
  const today = [...new Set(workoutExerciseIds.filter((id) => dayExerciseIds.includes(id)))]
  return routine.join() !== today.join()
}
