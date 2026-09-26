import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi } from 'vitest'
import type { ExerciseDetail, ExerciseSummary, UserOut } from '../api/schema'
import { createQueryClient } from '../queryClient'
import { routes } from '../routes'

type Params = Record<string, string>
type Handler = (url: URL, request: Request, params: Params) => unknown
type Reply = { status: number; body: unknown }

/** Reply with a non-200 status from a handler. */
export const reply = (status: number, body: unknown = { detail: 'error' }): Reply => ({
  status,
  body,
})

/**
 * Fakes the backend: `handlers` maps "GET /api/me" style keys (":name" segments match any
 * value and are passed as params) to functions returning a JSON body, `reply(status, body)`,
 * or a promise of either. Returns the list of requested URLs for assertions.
 */
export function mockApi(handlers: Record<string, Handler>): URL[] {
  const requests: URL[] = []
  const routes = Object.entries(handlers).map(([key, handler]) => {
    const [method, path] = key.split(' ') as [string, string]
    const names: string[] = []
    const pattern = path.replace(/:(\w+)/g, (_, name: string) => {
      names.push(name)
      return '([^/]+)'
    })
    return { method, regex: new RegExp(`^${pattern}$`), names, handler }
  })

  vi.stubGlobal('fetch', async (input: Request) => {
    const url = new URL(input.url)
    requests.push(url)
    for (const route of routes) {
      const match = input.method === route.method && route.regex.exec(url.pathname)
      if (!match) continue
      const params = Object.fromEntries(route.names.map((name, i) => [name, match[i + 1]!]))
      const result = await route.handler(url, input, params)
      return isReply(result) ? json(result.status, result.body) : json(200, result)
    }
    return json(404, { detail: `No mock for ${input.method} ${url.pathname}` })
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
  setup_completed_at: '2026-09-01T00:00:00Z',
  rest_timer_enabled: true,
  default_rest_seconds: 90,
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
