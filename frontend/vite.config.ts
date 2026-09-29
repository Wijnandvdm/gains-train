import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true },
  test: {
    environment: 'jsdom',
    // One jsdom per worker instead of one per test file (much faster), while each file
    // still runs in its own isolated VM context.
    pool: 'vmThreads',
    setupFiles: ['./src/test/setup.ts'],
    // Must exceed Testing Library's asyncUtilTimeout (5s, see src/test/setup.ts).
    testTimeout: 15_000,
  },
})
