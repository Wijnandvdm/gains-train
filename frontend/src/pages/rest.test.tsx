import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DAY2_ROUTINE, fakeBackend, ROW } from '../test/fakeBackend'
import { renderApp } from '../test/utils'

const done = () =>
  within(screen.getByRole('region', { name: 'Current set' })).getByRole('button', {
    name: '✓ Done',
  })
const timer = () => screen.queryByRole('timer', { name: 'Rest timer' })

describe('rest per exercise', () => {
  it('uses the exercise’s rest, and remembers ±15s for that exercise', async () => {
    const backend = fakeBackend({}, { routine: DAY2_ROUTINE })
    const user = userEvent.setup()
    renderApp('/workout')

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    expect(timer()).toHaveTextContent('1:30') // Seated Cable Rows: isolation → automatic 1:30

    await user.click(screen.getByRole('button', { name: '+15s' }))
    expect(timer()).toHaveTextContent(/1:4[45]/)
    await waitFor(() => expect(backend.state.restPrefs.get(ROW.id)).toBe(105))
    // The card's picker shows the remembered time, and the next set rests that long.
    const picker = screen.getByLabelText('Rest after each set of Seated Cable Rows')
    await waitFor(() => expect(picker).toHaveValue('105'))
    await user.click(screen.getByRole('button', { name: 'Depart' }))
    await user.click(done())
    expect(timer()).toHaveTextContent('1:45')
  })

  it('can switch the timer off for one exercise', async () => {
    fakeBackend({}, { routine: DAY2_ROUTINE })
    const user = userEvent.setup()
    renderApp('/workout')

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    await user.click(screen.getByRole('button', { name: 'Depart' }))
    await user.selectOptions(
      screen.getByLabelText('Rest after each set of Seated Cable Rows'),
      'No timer',
    )
    await user.click(done())
    expect(timer()).toBeNull()
  })

  it('can switch the timer off everywhere', async () => {
    const backend = fakeBackend({}, { routine: DAY2_ROUTINE })
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByText('Account'))
    const toggle = screen.getByRole('switch', { name: 'Rest timer' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(backend.state.me.rest_timer_enabled).toBe(false)

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    expect(timer()).toBeNull()
  })
})
