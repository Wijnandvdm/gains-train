import { describe, expect, it } from 'vitest'
import { db } from './db'
import { saveMachineSettings, settingLabel, tidySettings } from './machineSettings'

describe('machine settings', () => {
  it('keeps them tidy: trimmed, no empty rows, at most six', () => {
    expect(
      tidySettings([
        { name: '  Seat ', value: ' 4 ' },
        { name: '', value: '' },
        { name: '', value: '13' }, // just a value is fine
      ]),
    ).toEqual([
      { name: 'Seat', value: '4' },
      { name: '', value: '13' },
    ])
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `S${i}`, value: String(i) }))
    expect(tidySettings(many)).toHaveLength(6)
  })

  it('saves them per exercise, and removes them when emptied', async () => {
    await saveMachineSettings('Leg_Curl', [{ name: 'Pad', value: 'L' }])
    expect(await db.machineSettings.get('Leg_Curl')).toEqual({
      exercise_id: 'Leg_Curl',
      settings: [{ name: 'Pad', value: 'L' }],
    })
    await saveMachineSettings('Leg_Curl', [{ name: ' ', value: '' }])
    expect(await db.machineSettings.get('Leg_Curl')).toBeUndefined()
  })

  it('reads as "Seat 4", or just the value', () => {
    expect(settingLabel({ name: 'Seat', value: '4' })).toBe('Seat 4')
    expect(settingLabel({ name: '', value: '−1' })).toBe('−1')
  })
})
