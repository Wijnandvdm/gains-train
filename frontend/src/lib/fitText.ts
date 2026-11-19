/**
 * A font size that fits `text` in the width of its container (a CSS size container, e.g.
 * Tailwind's `@container`), up to `max`: long numbers shrink instead of being cut off.
 * Widths are estimated per character, in em, for bold tabular digits.
 */
export function fitFontSize(text: string, max = '1.875rem'): string {
  const ems = [...text].reduce((sum, c) => sum + (/[0-9–]/.test(c) ? 0.62 : 0.35), 0.2)
  return `min(${max}, ${(100 / ems).toFixed(1)}cqw)`
}
