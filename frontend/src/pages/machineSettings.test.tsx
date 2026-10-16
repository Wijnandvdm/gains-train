import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { DAY2_ROUTINE, LAST_DAY2, ROW, seedDevice } from '../test/device'
import { renderApp } from '../test/utils'

const card = () => screen.getByRole('region', { name: 'Current set' })
const chips = (within_: HTMLElement) =>
  within(within(within_).getByRole('list', { name: 'Machine settings' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

async function addSettings(user: ReturnType<typeof userEvent.setup>, where: HTMLElement) {
  // The settings load a moment after the screen.
  await user.click(await within(where).findByRole('button', { name: '+ Machine settings' }))
  await user.type(within(where).getByLabelText('Setting 1 name'), 'Seat')
  await user.type(within(where).getByLabelText('Setting 1 value'), '4')
  await user.click(within(where).getByRole('button', { name: '+ Add setting' }))
  await user.type(within(where).getByLabelText('Setting 2 value'), '13') // just a value
  await user.click(within(where).getByRole('button', { name: 'Save' }))
}

describe('machine settings', () => {
  it('shows them on the set card until the first set is done, then on ⚙', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    await db.machineSettings.put({
      exercise_id: ROW.id,
      settings: [
        { name: 'Seat', value: '4' },
        { name: 'Pad', value: 'L' },
      ],
    })
    const user = userEvent.setup()
    renderApp('/workout')

    // The card settles once last time's numbers are in (80 × 12).
    await screen.findByDisplayValue('80')
    expect(await within(card()).findByRole('list', { name: 'Machine settings' })).toBeVisible()
    expect(chips(card())).toEqual(['Seat 4', 'Pad L'])

    await user.click(within(card()).getByRole('button', { name: '✓ Done' }))
    await screen.findByRole('button', { name: 'Show machine settings' }) // set 2's card
    expect(within(card()).queryByRole('list', { name: 'Machine settings' })).toBeNull()
    // Set 2's card settles while the workout loads: tap ⚙ until the settings show.
    await waitFor(async () => {
      const gear = within(card()).queryByRole('button', { name: 'Show machine settings' })
      if (gear) await user.click(gear)
      expect(chips(card())).toEqual(['Seat 4', 'Pad L'])
    })
  })

  it('sets them right on the set card, for next time', async () => {
    await seedDevice({ routine: DAY2_ROUTINE, workouts: [LAST_DAY2] })
    const user = userEvent.setup()
    renderApp('/workout')

    // The card settles once last time's numbers are in (80 × 12).
    await screen.findByDisplayValue('80')
    await addSettings(user, card())
    expect(await within(card()).findByRole('list', { name: 'Machine settings' })).toBeVisible()
    expect(chips(card())).toEqual(['Seat 4', '13'])
    expect((await db.machineSettings.get(ROW.id))!.settings).toEqual([
      { name: 'Seat', value: '4' },
      { name: '', value: '13' },
    ])
  })

  it('sets them in the routine editor, for the exercise everywhere', async () => {
    await seedDevice({ routine: DAY2_ROUTINE })
    const user = userEvent.setup()
    renderApp('/routine')

    const row = (await screen.findByText(ROW.name)).closest('li')!
    await addSettings(user, row)
    expect(await within(row).findByRole('list', { name: 'Machine settings' })).toBeVisible()
    expect((await db.machineSettings.get(ROW.id))!.settings).toHaveLength(2)
  })

  it('sets and changes them on the exercise page', async () => {
    await seedDevice()
    const user = userEvent.setup()
    renderApp(`/exercises/${ROW.id}`)

    const section = (await screen.findByRole('heading', { name: 'Machine settings' }))
      .parentElement!
    await addSettings(user, section)
    expect(await within(section).findByRole('list', { name: 'Machine settings' })).toBeVisible()

    await user.click(within(section).getByRole('button', { name: 'Change machine settings' }))
    await user.click(within(section).getByRole('button', { name: 'Remove setting 2' }))
    await user.click(within(section).getByRole('button', { name: 'Save' }))
    expect(await within(section).findByText('Seat 4')).toBeVisible()
    expect((await db.machineSettings.get(ROW.id))!.settings).toEqual([{ name: 'Seat', value: '4' }])
  })
})
