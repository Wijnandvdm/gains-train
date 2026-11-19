import { describe, expect, it } from 'vitest'
import { CHEERS, cheer, firebox } from './copy'

describe('train copy', () => {
  it('rotates cheers per set, starting with "well on track"', () => {
    expect(cheer(1)).toBe("You're well on track!")
    expect(cheer(2)).toBe('Full steam ahead!')
    expect(cheer(CHEERS.length + 1)).toBe(cheer(1))
  })

  it('tells the weight you moved as coal, when there is any', () => {
    expect(firebox(1840)).toMatch(/^1\D?840 kg shovelled into the firebox\.$/)
    expect(firebox(0)).toBeNull()
  })
})
