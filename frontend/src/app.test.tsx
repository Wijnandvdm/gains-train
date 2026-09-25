import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { safeNext } from './auth'
import { exercise, exerciseDetail, ME, mockApi, renderApp, reply } from './test/utils'

const LIBRARY = [
  exercise(1, 'Seated Leg Curl', {
    image_urls: ['/api/exercise-images/Seated_Leg_Curl/0.jpg'],
  }),
  exercise(2, 'Preacher Curl', {
    equipment: 'barbell',
    primary_muscles: ['biceps'],
  }),
  exercise(3, 'Bulgarian Split Squat', {
    equipment: 'dumbbell',
    is_custom: true,
    primary_muscles: ['quadriceps', 'glutes'],
  }),
]

const FILTERS = {
  muscles: ['biceps', 'glutes', 'hamstrings', 'quadriceps'],
  equipment: ['barbell', 'dumbbell', 'machine'],
  categories: ['strength'],
}

/** A fake exercises endpoint that honours the q and muscle filters. */
function listExercises(url: URL) {
  const q = url.searchParams.get('q')?.toLowerCase()
  const muscle = url.searchParams.get('muscle')
  const items = LIBRARY.filter(
    (e) =>
      (!q || q.split(' ').every((word) => e.name.toLowerCase().includes(word))) &&
      (!muscle || e.primary_muscles.includes(muscle)),
  )
  return { items, total: items.length, limit: 30, offset: 0 }
}

const signedIn = {
  'GET /api/me': () => ME,
  'GET /api/exercises': listExercises,
  'GET /api/exercises/filters': () => FILTERS,
}

describe('auth', () => {
  it('redirects to login when signed out, remembering where you were going', async () => {
    mockApi({
      'GET /api/me': () => reply(401),
      'GET /api/auth/config': () => ({ google_client_id: 'test' }),
    })
    const router = renderApp('/exercises?muscle=biceps')

    expect(await screen.findByText('Log your lifts. Watch the numbers go up.')).toBeVisible()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe(
      '/exercises?muscle=biceps',
    )
  })

  it('sends you to login when the session expires mid-use', async () => {
    mockApi({ ...signedIn, 'GET /api/exercises': () => reply(401) })
    const router = renderApp('/exercises')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it.each([
    ['/exercises?q=curl', '/exercises?q=curl'],
    [null, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
  ])('safeNext(%j) → %j', (next, expected) => {
    expect(safeNext(next)).toBe(expected)
  })
})

describe('exercise library', () => {
  it('lists exercises with muscles, equipment and a custom badge', async () => {
    mockApi(signedIn)
    renderApp('/exercises')

    const card = (await screen.findByText('Bulgarian Split Squat')).closest('a')!
    expect(card).toHaveAttribute('href', '/exercises/3')
    expect(within(card).getByText('quadriceps, glutes')).toBeVisible()
    expect(within(card).getByText('Custom')).toBeVisible()
    expect(screen.getByText('3 exercises')).toBeVisible()
  })

  it('filters by muscle via the URL', async () => {
    const requests = mockApi(signedIn)
    const router = renderApp('/exercises')

    await userEvent.click(await screen.findByRole('button', { name: 'biceps' }))

    expect(await screen.findByText('1 exercise')).toBeVisible()
    expect(screen.getByText('Preacher Curl')).toBeVisible()
    expect(screen.getByRole('button', { name: 'biceps' })).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?muscle=biceps')
    expect(requests.at(-1)?.searchParams.get('muscle')).toBe('biceps')
  })

  it('debounces search: one request once typing pauses', async () => {
    const requests = mockApi(signedIn)
    const router = renderApp('/exercises')
    await screen.findByText('3 exercises')

    await userEvent.type(screen.getByRole('searchbox'), 'leg curl')

    expect(await screen.findByText('1 exercise')).toBeVisible()
    const searches = requests.filter(
      (u) => u.pathname === '/api/exercises' && u.searchParams.has('q'),
    )
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['leg curl'])
    expect(router.state.location.search).toBe('?q=leg+curl')
  })

  it('restores filters from the URL', async () => {
    mockApi(signedIn)
    renderApp('/exercises?q=curl&muscle=biceps')

    expect(await screen.findByText('Preacher Curl')).toBeVisible()
    expect(screen.getByRole('searchbox')).toHaveValue('curl')
    expect(screen.getByRole('button', { name: 'biceps' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('exercise detail', () => {
  it('shows images, muscles and instructions', async () => {
    mockApi({
      ...signedIn,
      'GET /api/exercises/1': () =>
        exerciseDetail(
          exercise(1, 'Seated Leg Curl', {
            secondary_muscles: ['calves'],
            image_urls: ['/img/0.jpg', '/img/1.jpg'],
          }),
          ['Sit down.', 'Curl your legs.'],
        ),
    })
    renderApp('/exercises/1')

    expect(await screen.findByRole('heading', { name: 'Seated Leg Curl' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'hamstrings' })).toHaveAttribute(
      'href',
      '/exercises?muscle=hamstrings',
    )
    expect(screen.getByRole('link', { name: 'calves' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'How to' })).toBeVisible()
    expect(screen.getByText('Curl your legs.')).toBeVisible()
    expect(document.querySelectorAll('img[src^="/img/"]')).toHaveLength(2)
  })

  it('says so when an exercise does not exist', async () => {
    mockApi({ ...signedIn, 'GET /api/exercises/999': () => reply(404) })
    renderApp('/exercises/999')
    expect(await screen.findByText("This exercise doesn't exist.")).toBeVisible()
  })
})
