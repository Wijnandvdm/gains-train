import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { seedDevice } from './test/device'
import { libraryExercise } from './test/library'
import { renderApp } from './test/utils'

const LIBRARY = [
  libraryExercise('Seated_Leg_Curl', 'Seated Leg Curl', {
    secondary_muscles: ['calves'],
    instructions: ['Sit down.', 'Curl your legs.'],
  }),
  libraryExercise('Preacher_Curl', 'Preacher Curl', {
    equipment: 'barbell',
    primary_muscles: ['biceps'],
  }),
]
const BULGARIAN = libraryExercise('custom-bss', 'Bulgarian Split Squat', {
  equipment: 'dumbbell',
  is_custom: true,
  primary_muscles: ['quadriceps', 'glutes'],
  image_urls: [],
  instructions: [],
})

const seed = () => seedDevice({ library: LIBRARY, customExercises: [BULGARIAN] })

describe('first open', () => {
  it('starts with setup, from any page', async () => {
    await seedDevice({ setupDone: false })
    const router = renderApp('/progress')
    expect(await screen.findByRole('heading', { name: "Let's lay the tracks" })).toBeVisible()
    expect(router.state.location.pathname).toBe('/setup')
  })
})

describe('exercise library', () => {
  it('lists exercises with muscles, equipment and a custom badge', async () => {
    await seed()
    renderApp('/exercises')

    const card = (await screen.findByText('Bulgarian Split Squat')).closest('a')!
    expect(card).toHaveAttribute('href', '/exercises/custom-bss')
    expect(within(card).getByText('quadriceps, glutes')).toBeVisible()
    expect(within(card).getByText('Custom')).toBeVisible()
    expect(screen.getByText('3 exercises')).toBeVisible()
  })

  it('filters by muscle via the URL', async () => {
    await seed()
    const router = renderApp('/exercises')

    await userEvent.click(await screen.findByRole('button', { name: 'biceps' }))

    expect(await screen.findByText('1 exercise')).toBeVisible()
    expect(screen.getByText('Preacher Curl')).toBeVisible()
    expect(screen.getByRole('button', { name: 'biceps' })).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?muscle=biceps')
  })

  it('searches as you type, every word counting', async () => {
    await seed()
    const router = renderApp('/exercises')
    await screen.findByText('3 exercises')

    await userEvent.type(screen.getByRole('searchbox'), 'leg curl')

    expect(await screen.findByText('1 exercise')).toBeVisible()
    expect(screen.getByText('Seated Leg Curl')).toBeVisible()
    await waitFor(() => expect(router.state.location.search).toBe('?q=leg+curl'))
  })

  it('restores filters from the URL', async () => {
    await seed()
    renderApp('/exercises?q=curl&muscle=biceps')

    expect(await screen.findByText('Preacher Curl')).toBeVisible()
    expect(screen.getByRole('searchbox')).toHaveValue('curl')
    expect(screen.getByRole('button', { name: 'biceps' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('exercise detail', () => {
  it('shows images, muscles and instructions', async () => {
    await seed()
    renderApp('/exercises/Seated_Leg_Curl')

    expect(await screen.findByRole('heading', { name: 'Seated Leg Curl' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'hamstrings' })).toHaveAttribute(
      'href',
      '/exercises?muscle=hamstrings',
    )
    expect(screen.getByRole('link', { name: 'calves' })).toBeVisible()
    // The muscle map draws front + back, and describes itself for screen readers.
    const map = screen.getByRole('img', { name: 'Muscles worked: hamstrings; also calves' })
    await waitFor(() => expect(map.querySelectorAll('svg')).toHaveLength(2))
    expect(screen.getByRole('heading', { name: 'How to' })).toBeVisible()
    expect(screen.getByText('Curl your legs.')).toBeVisible()
    expect(document.querySelectorAll('img[src^="/exercises/Seated_Leg_Curl/"]')).toHaveLength(2)
  })

  it('says so when an exercise does not exist', async () => {
    await seed()
    renderApp('/exercises/Nope')
    expect(await screen.findByText("This exercise doesn't exist.")).toBeVisible()
  })
})
