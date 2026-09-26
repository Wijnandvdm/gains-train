import { describe, expect, it } from 'vitest'
import { exercise } from '../test/utils'
import { restSecondsFor, smartRestSeconds } from './rest'

const hackSquat = exercise(1, 'Hack Squat', {
  mechanic: 'compound',
  primary_muscles: ['quadriceps'],
})
const pulldown = exercise(2, 'Lat Pulldown', { mechanic: 'compound', primary_muscles: ['lats'] })
const legExtension = exercise(3, 'Leg Extensions', {
  mechanic: 'isolation',
  primary_muscles: ['quadriceps'],
})
const wristCurl = exercise(4, 'Wrist Curl', {
  mechanic: 'isolation',
  primary_muscles: ['forearms'],
})
const custom = exercise(5, 'Bulgarian Split Squat', { mechanic: null, primary_muscles: [] })

describe('rest times', () => {
  it('picks smart defaults from the exercise', () => {
    expect(smartRestSeconds(hackSquat, 90)).toBe(180) // compound legs
    expect(smartRestSeconds(pulldown, 90)).toBe(120) // other compound
    expect(smartRestSeconds(legExtension, 90)).toBe(90) // isolation
    expect(smartRestSeconds(wristCurl, 90)).toBe(60) // small muscles
    expect(smartRestSeconds(custom, 75)).toBe(75) // unknown: your default
  })

  it('uses your own setting first, including "no timer"', () => {
    const prefs = new Map([
      [1, 240],
      [2, 0],
    ])
    expect(restSecondsFor(hackSquat, prefs, 90)).toBe(240)
    expect(restSecondsFor(pulldown, prefs, 90)).toBe(0)
    expect(restSecondsFor(legExtension, prefs, 90)).toBe(90)
  })
})
