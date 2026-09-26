import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { DAY2_ROUTINE, getSettings, LAST_DAY2, ROW, seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

const done = () =>
  within(screen.getByRole('region', { name: 'Current set' })).getByRole('button', {
    name: '✓ Done',
  })
const timer = () => screen.queryByRole('timer', { name: 'Rest timer' })

describe('rest per exercise', () => {
  it('uses the exercise’s rest, and remembers ±15s for that exercise', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    // Seated Cable Rows: isolation → automatic 1:30
    await waitFor(() => expect(timer()).toHaveTextContent('1:30'))

    await user.click(screen.getByRole('button', { name: '+15s' }))
    expect(timer()).toHaveTextContent(/1:4[45]/)
    await waitFor(async () => expect((await db.restPrefs.get(ROW.id))?.rest_seconds).toBe(105))
    // The card's picker shows the remembered time, and the next set rests that long.
    const picker = screen.getByLabelText('Rest after each set of Seated Cable Rows')
    await waitFor(() => expect(picker).toHaveValue('105'))
    await user.click(screen.getByRole('button', { name: 'Depart' }))
    await user.click(done())
    expect(timer()).toHaveTextContent('1:45')
  })

  it('can switch the timer off for one exercise', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    await user.click(await screen.findByRole('button', { name: 'Depart' }))
    await user.selectOptions(
      screen.getByLabelText('Rest after each set of Seated Cable Rows'),
      'No timer',
    )
    await user.click(done())
    expect(timer()).toBeNull()
  })

  it('can switch the timer off everywhere', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')

    await user.click(await screen.findByRole('link', { name: 'Settings' }))
    const toggle = await screen.findByRole('switch', { name: 'Start a rest timer after each set' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect((await getSettings()).rest_timer_enabled).toBe(false)

    await user.click(screen.getByRole('link', { name: 'Workout' }))

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    await expectNoRestTimer()
  })

  it('can opt out of rest timers when setting up', async () => {
    await seedDevice({ setupDone: false, routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/setup')

    await user.click(await screen.findByRole('radio', { name: /No fixed routine/ }))
    await user.click(screen.getByRole('button', { name: 'No timer' }))
    expect(screen.getByText(/No countdown or alerts/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'All aboard! 🚂' }))
    expect(await getSettings()).toMatchObject({ rest_timer_enabled: false })

    await waitFor(() => expect(done()).toBeEnabled())
    await user.click(done())
    await expectNoRestTimer()
  })
})

/** After logging set 1: no countdown, and no rest picker on the exercise either. */
async function expectNoRestTimer() {
  await screen.findByRole('region', { name: 'Seated Cable Rows' }) // the workout has started
  expect(timer()).toBeNull()
  expect(screen.queryByLabelText(/^Rest after each set/)).toBeNull()
}
