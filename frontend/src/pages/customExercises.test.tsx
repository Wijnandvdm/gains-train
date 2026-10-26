import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import type { ExerciseDetail } from '../data/types'
import { seedDevice, set, workout } from '../test/device'
import { renderApp } from '../test/utils'

const SLED: ExerciseDetail = {
  id: 'custom-sled',
  name: 'Sled push',
  equipment: null,
  category: null,
  level: null,
  mechanic: null,
  force: null,
  is_custom: true,
  primary_muscles: [],
  secondary_muscles: [],
  image_urls: [],
  instructions: [],
}

describe('your own exercises', () => {
  it('makes one from the exercise picker and adds it to the workout', async () => {
    await seedDevice()
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    const picker = screen.getByRole('dialog', { name: 'Add exercise' })
    await user.type(within(picker).getByRole('searchbox'), 'Hip thrust machine')
    await user.click(
      await within(picker).findByRole('button', { name: '+ Create “Hip thrust machine”' }),
    )

    const form = within(picker).getByRole('form', { name: 'New exercise' })
    expect(within(form).getByLabelText('Name')).toHaveValue('Hip thrust machine')
    await user.selectOptions(within(form).getByLabelText('Main muscle (optional)'), 'lats')
    await user.click(within(form).getByRole('button', { name: 'Create and add' }))

    expect(await screen.findByRole('region', { name: 'Hip thrust machine' })).toBeVisible()
    expect(await db.customExercises.toArray()).toMatchObject([
      { name: 'Hip thrust machine', primary_muscles: ['lats'] },
    ])
  })

  it('makes one on the Exercises tab, adds how-to steps later, and deletes it', async () => {
    await seedDevice()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/exercises')

    await user.click(await screen.findByRole('button', { name: 'New exercise' }))
    await user.type(screen.getByLabelText('Name'), 'Sled push')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByRole('heading', { name: 'Sled push' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Edit · add how-to steps' }))
    await user.type(
      screen.getByLabelText('How to (one step per line)'),
      'Lean into the handles.{Enter}Drive with your legs.',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const howTo = await screen.findByRole('heading', { name: 'How to' })
    expect(
      within(howTo.parentElement!)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Lean into the handles.', 'Drive with your legs.'])

    // Delete shows once the app has checked you haven't used it anywhere.
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { name: 'Exercises' })).toBeVisible()
    expect(await db.customExercises.count()).toBe(0)
  })

  it('keeps one you have logged', async () => {
    await seedDevice({
      customExercises: [SLED],
      workouts: [workout({ id: 'w' }, [[SLED.id, [set('s', 'we', 1, 50, 10)]]])],
    })
    renderApp(`/exercises/${SLED.id}`)

    expect(
      await screen.findByText(/You’ve logged this exercise, so it can’t be deleted/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })
})
