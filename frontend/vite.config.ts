import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const BRAND_GREEN = '#16a34a'

// https://vite.dev/config/
// `--mode android` builds for the Android app (scripts/android.sh).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline support. The service worker is only built for production
    // (`npm run build && npm run preview`); `npm run dev` runs without it.
    VitePWA({
      // The Android app has everything built in and updates through a new install, so it
      // needs no service worker (the update prompt then never shows).
      disable: mode === 'android',
      // Ask before switching to a new version, rather than reloading mid-workout.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'gains-train',
        short_name: 'gains-train',
        description: 'All aboard the gains train! Log your lifts, watch the numbers go up.',
        start_url: '/workout',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: BRAND_GREEN,
        background_color: '#fafafa',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app itself (JS, CSS, HTML, icons) and the exercise library's data are cached
        // up front: it opens instantly and works without a connection. The ~100 MB of
        // exercise photos are not; each one is cached the first time it's shown.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', 'exercises/exercises.json'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Exercise photos never change (the dataset version is pinned).
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/exercises/') && url.pathname.endsWith('.jpg'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 2000, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: { host: true },
  preview: { host: true },
  test: {
    environment: 'jsdom',
    // One jsdom per worker instead of one per test file (much faster), while each file
    // still runs in its own isolated VM context.
    pool: 'vmThreads',
    setupFiles: ['./src/test/setup.ts'],
    // Must exceed Testing Library's asyncUtilTimeout (5s, see src/test/setup.ts).
    testTimeout: 15_000,
  },
}))
