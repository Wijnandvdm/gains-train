import 'fake-indexeddb/auto' // an in-memory IndexedDB for jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { db } from '../data/db'
import { setLibraryForTests } from '../data/library'

// Role queries are slow in jsdom; with the suite running in parallel, the default 1s wait
// for elements to appear is occasionally too short and makes tests flaky.
configure({ asyncUtilTimeout: 5_000 })

// The app never talks to a server: any network request in a test is a bug.
beforeEach(() => {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    throw new Error(`Unexpected network request: ${String(input)}`)
  })
})

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  // Every test starts with an empty on-device database.
  await Promise.all(db.tables.map((table) => table.clear()))
  setLibraryForTests(null)
})
