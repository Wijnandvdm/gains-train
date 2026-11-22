/**
 * Light or dark: your choice in Settings → Appearance, or (the default) like the rest of the
 * phone. The app shows it with data-theme on <html>: index.css and Tailwind's dark: classes
 * follow that attribute, not the phone directly. The choice is also kept in localStorage, so
 * index.html can set it before the app has loaded, and it starts in the right colours.
 */
import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { getSettings } from './data/db'
import type { ThemeChoice } from './data/types'

/** Where index.html finds your choice before the app loads: keep the two the same. */
const STORAGE_KEY = 'gains-train-theme'
const PHONE_DARK = '(prefers-color-scheme: dark)'

const phoneIsDark = () => window.matchMedia?.(PHONE_DARK).matches ?? false

/** Show the app light or dark, and remember the choice for the next start. */
export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === 'dark' || (choice === 'phone' && phoneIsDark())
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Storage blocked: the app still switches, only the next start may open in the other one.
  }
}

/** Keep the colours in step with your choice (also after restoring a backup) and the phone. */
export function followTheme(): void {
  let choice: ThemeChoice = 'phone'
  liveQuery(getSettings).subscribe({
    next: (settings) => applyTheme((choice = settings.theme)),
    error: (e: unknown) => console.warn('Theme setting unavailable', e),
  })
  window.matchMedia?.(PHONE_DARK).addEventListener('change', () => applyTheme(choice))
}

const shown = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

function onThemeChange(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

/** The colours showing now, for what draws with them itself (the muscle map). */
export function useShownTheme(): 'light' | 'dark' {
  return useSyncExternalStore(onThemeChange, shown)
}
