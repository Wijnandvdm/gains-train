import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { outbox } from '../workout/sync'

// Role queries are slow in jsdom; with the suite running in parallel, the default 1s wait
// for elements to appear is occasionally too short and makes tests flaky.
configure({ asyncUtilTimeout: 5_000 })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  outbox.reset()
  localStorage.clear()
})
