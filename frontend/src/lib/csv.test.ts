import { describe, expect, it } from 'vitest'
import { parseCsv, readCsv, toCsv } from './csv'

describe('CSV', () => {
  it('quotes what needs it and reads it back, line breaks and all', () => {
    const records: Record<string, string>[] = [
      { a: 'plain', b: 'with, comma' },
      { a: 'say "hi"', b: 'two\nlines' },
      { a: '' },
    ]
    const text = toCsv(['a', 'b'], records)
    expect(text.startsWith('﻿a,b\r\nplain,"with, comma"\r\n')).toBe(true)
    expect(readCsv(text, ['a', 'b'])).toEqual([
      { a: 'plain', b: 'with, comma' },
      { a: 'say "hi"', b: 'two\nlines' },
      // an all-empty row is dropped
    ])
  })

  it('handles files saved by spreadsheets (no BOM, LF endings, no final newline)', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('names missing columns', () => {
    expect(() => readCsv('a\n1\n', ['a', 'b', 'c'])).toThrow('missing columns: b, c')
  })
})
