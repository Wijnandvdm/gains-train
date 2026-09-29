import { describe, expect, it } from 'vitest'
import { getSettings, updateSettings } from './db'
import { leaveDepot, parkWeek, parkWeeks } from './depot'

describe('the depot', () => {
  it('parks this week and the next ones', async () => {
    await parkWeeks(3, '2026-09-17')
    expect((await getSettings()).depot_weeks).toEqual(['2026-09-14', '2026-09-21', '2026-09-28'])
  })

  it('parks a week that already ended, keeping earlier ones', async () => {
    await updateSettings({ depot_weeks: ['2026-08-03'] })
    await parkWeek('2026-09-07')
    await parkWeek('2026-09-07') // twice is fine
    expect((await getSettings()).depot_weeks).toEqual(['2026-08-03', '2026-09-07'])
  })

  it('leaving unparks this week and later, but not the past', async () => {
    await updateSettings({ depot_weeks: ['2026-09-07', '2026-09-14', '2026-09-21'] })
    await leaveDepot('2026-09-17')
    expect((await getSettings()).depot_weeks).toEqual(['2026-09-07'])
  })
})
