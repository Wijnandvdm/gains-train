import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { toSummary } from '../data/library'
import type { ExerciseSummary } from '../data/types'
import { routes } from '../routes'
import { libraryExercise } from './library'

/** Renders the real app routes at `path`. Seed the device first (see ./device). */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

/** An exercise as the screens get it (a library exercise without instructions). */
export function exercise(
  id: string,
  name: string,
  overrides: Partial<ExerciseSummary> = {},
): ExerciseSummary {
  return toSummary(libraryExercise(id, name, overrides))
}
