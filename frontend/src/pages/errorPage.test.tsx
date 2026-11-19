import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

// A screen that crashes, in place of the real Progress screen.
vi.mock('./ProgressPage', () => ({
  ProgressPage: () => {
    throw new Error('The boiler burst')
  },
}))

describe('when a screen crashes', () => {
  it('says so kindly, keeps the tabs, and folds the error away', async () => {
    await seedDevice()
    vi.spyOn(console, 'error').mockImplementation(() => {}) // React and the page log it
    const user = userEvent.setup()
    renderApp('/progress')

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByRole('heading', { name: 'Something went off the rails' }),
    ).toBeVisible()
    expect(within(alert).getByText(/Your workouts are safe/)).toBeVisible()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(within(alert).getByRole('link', { name: 'Go to Workout' })).toHaveAttribute(
      'href',
      '/workout',
    )
    // Not React Router's developer message.
    expect(screen.queryByText(/providing your own ErrorBoundary/)).toBeNull()

    // The app around it is still there: tap away to another tab.
    expect(screen.getByRole('link', { name: 'History' })).toBeVisible()
    await user.click(within(alert).getByText('Details (to pass on)'))
    expect(within(alert).getByText(/Error: The boiler burst/)).toBeVisible()
  })
})
