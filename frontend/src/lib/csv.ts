/**
 * CSV (RFC 4180): fields with a comma, quote or line break are quoted, quotes doubled. Files
 * start with a byte-order mark so Excel reads UTF-8 (the "·" in workout names) correctly.
 */
const BOM = '﻿'

const field = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

/** A CSV file: the header row, then one row per record (missing fields are empty). */
export function toCsv(header: string[], records: Record<string, string>[]): string {
  const lines = [header, ...records.map((r) => header.map((h) => r[h] ?? ''))]
  return BOM + lines.map((row) => row.map(field).join(',')).join('\r\n') + '\r\n'
}

/** Parse CSV text into rows of fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  const input = text.startsWith(BOM) ? text.slice(1) : text
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        value += '"'
        i++
      } else if (c === '"') quoted = false
      else value += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(value)
      value = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else value += c
  }
  if (value !== '' || row.length > 0) {
    row.push(value)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f !== ''))
}

/** Records keyed by the header; throws when a required column is missing. */
export function readCsv(text: string, required: string[]): Record<string, string>[] {
  const [header = [], ...rows] = parseCsv(text)
  const missing = required.filter((column) => !header.includes(column))
  if (missing.length)
    throw new Error(`missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`)
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])))
}
