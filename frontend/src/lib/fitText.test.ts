import { describe, expect, it } from 'vitest'
import { fitFontSize } from './fitText'

const cqw = (size: string) => Number(/, ([\d.]+)cqw\)$/.exec(size)![1])

describe('fitting a number in its box', () => {
  it('shrinks longer numbers, and never grows past the largest size', () => {
    expect(fitFontSize('80')).toMatch(/^min\(1\.875rem, [\d.]+cqw\)$/)
    expect(cqw(fitFontSize('102.5'))).toBeLessThan(cqw(fitFontSize('100')))
    expect(cqw(fitFontSize('100'))).toBeLessThan(cqw(fitFontSize('80')))
    expect(cqw(fitFontSize('1000.5'))).toBeLessThan(cqw(fitFontSize('102.5')))
  })
})
