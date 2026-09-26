import { describe, expect, it } from 'vitest'
import { CHEERS, cheer } from './copy'

describe('train copy', () => {
  it('rotates cheers per set, starting with "well on track"', () => {
    expect(cheer(1)).toBe("You're well on track!")
    expect(cheer(2)).toBe('Full steam ahead!')
    expect(cheer(CHEERS.length + 1)).toBe(cheer(1))
  })
})
