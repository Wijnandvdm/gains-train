import { describe, expect, it } from 'vitest'
import {
  formatE1rm,
  formatNumber,
  formatVolume,
  formatWeight,
  parseWeight,
  weightInputText,
} from './format'

const NNBSP = ' ' // narrow no-break space

describe('number formatting', () => {
  it('uses a dot for decimals and a thin space for thousands, whatever the locale', () => {
    expect(formatNumber(11664)).toBe(`11${NNBSP}664`)
    expect(formatNumber(1234567.891)).toBe(`1${NNBSP}234${NNBSP}567.89`)
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(65.8)).toBe('65.8')
    expect(formatNumber(-1500.5, 1)).toBe(`-1${NNBSP}500.5`)
    expect(formatNumber(-0.001)).toBe('0')
  })

  it('has named formats for weights, e1RMs and volume', () => {
    expect(formatWeight(8.75)).toBe('8.75 kg')
    expect(formatWeight(82.5)).toBe('82.5 kg')
    expect(formatWeight(85)).toBe('85 kg')
    expect(formatE1rm(113.333)).toBe('113.3 kg')
    expect(formatVolume(7148.4)).toBe(`7${NNBSP}148 kg`)
    expect(formatVolume(32997)).toBe(`32${NNBSP}997 kg`)
  })

  it('keeps input text free of separators, so it parses back', () => {
    expect(weightInputText(1000)).toBe('1000')
    expect(weightInputText(82.5)).toBe('82.5')
    expect(weightInputText(null)).toBe('')
    expect(parseWeight(weightInputText(1234.56))).toBe(1234.56)
  })

  it('does not depend on the browser locale', () => {
    const original = Intl.NumberFormat
    // Even if something formatted with a Dutch locale, our output must not change.
    expect(new original('nl-NL').format(7148)).toBe('7.148')
    expect(formatVolume(7148)).toBe(`7${NNBSP}148 kg`)
  })
})
