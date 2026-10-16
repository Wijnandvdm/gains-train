import { describe, expect, it } from 'vitest'
import { moved, orderDiffers } from './reorder'

describe('reordering a workout', () => {
  it('moves one item, the rest shift around it', () => {
    expect(moved(['A', 'B', 'C'], 2, 0)).toEqual(['C', 'A', 'B'])
    expect(moved(['A', 'B', 'C'], 0, 1)).toEqual(['B', 'A', 'C'])
  })

  it('asks about the routine only when its exercises change order', () => {
    expect(orderDiffers(['A', 'B'], ['B', 'A'])).toBe(true)
    expect(orderDiffers(['A', 'B'], ['A', 'X', 'B'])).toBe(false) // only an extra one moved
    expect(orderDiffers(['A', 'B', 'C'], ['A', 'C'])).toBe(false) // B left out, rest in order
    expect(orderDiffers(['A', 'B'], ['X', 'B', 'A'])).toBe(true)
  })
})
