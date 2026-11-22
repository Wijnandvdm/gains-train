import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

describe('the privacy policy', () => {
  it('opens from Settings → About and reads offline, from PRIVACY.md', async () => {
    await seedDevice()
    const user = userEvent.setup()
    const router = renderApp('/settings')

    await user.click(await screen.findByRole('link', { name: 'Privacy policy' }))
    expect(await screen.findByRole('heading', { name: 'Privacy policy' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/privacy')

    // The policy's own headings and text, with its markdown turned into formatting.
    expect(screen.getByRole('heading', { name: 'What the app sends' })).toBeVisible()
    expect(screen.getByText('Gains Train collects no data.').tagName).toBe('STRONG')
    expect(
      screen.getByRole('link', { name: 'https://github.com/Wijnandvdm/gains-train/issues' }),
    ).toHaveAttribute('href', 'https://github.com/Wijnandvdm/gains-train/issues')
    expect(screen.queryByText(/\*\*|^#/)).toBeNull()

    // Plus the online version.
    expect(screen.getByRole('link', { name: 'the privacy policy on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Wijnandvdm/gains-train/blob/main/PRIVACY.md',
    )

    // Back goes back to Settings.
    await user.click(screen.getByText('Settings', { selector: 'main a' }))
    expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeVisible()
  })
})
