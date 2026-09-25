import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi } from 'vitest'
import type { ExerciseDetail, ExerciseSummary, UserOut } from '../api/schema'
import { createQueryClient } from '../queryClient'
import { routes } from '../routes'

type Handler = (url: URL, request: Request) => unknown
type Reply = { status: number; body: unknown }

/** Reply with a non-200 status from a handler. */
export const reply = (status: number, body: unknown = { detail: 'error' }): Reply => ({
  status,
  body,
})

/**
 * Fakes the backend: `handlers` maps "GET /api/me" style keys to functions returning a JSON
 * body (or `reply(status, body)`). Returns the list of requested URLs for assertions.
 */
export function mockApi(handlers: Record<string, Handler>): URL[] {
  const requests: URL[] = []
  vi.stubGlobal('fetch', async (input: Request) => {
    const url = new URL(input.url)
    requests.push(url)
    const handler = handlers[`${input.method} ${url.pathname}`]
    if (!handler)
      return json(404, {
        detail: `No mock for ${input.method} ${url.pathname}`,
      })
    const result = handler(url, input)
    return isReply(result) ? json(result.status, result.body) : json(200, result)
  })
  return requests
}

function isReply(value: unknown): value is Reply {
  return typeof value === 'object' && value !== null && 'status' in value && 'body' in value
}

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Renders the real app routes at `path`. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// --- Fixtures ----------------------------------------------------------------------------

export const ME: UserOut = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'me@example.com',
  name: 'Me',
  avatar_url: null,
}

export function exercise(
  id: number,
  name: string,
  overrides: Partial<ExerciseSummary> = {},
): ExerciseSummary {
  return {
    id,
    slug: name.replaceAll(' ', '_'),
    name,
    equipment: 'machine',
    category: 'strength',
    level: 'beginner',
    mechanic: 'isolation',
    force: 'pull',
    is_custom: false,
    primary_muscles: ['hamstrings'],
    secondary_muscles: [],
    image_urls: [],
    ...overrides,
  }
}

export function exerciseDetail(
  summary: ExerciseSummary,
  instructions: string[] = [],
): ExerciseDetail {
  return { ...summary, instructions }
}
