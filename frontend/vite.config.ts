import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const BRAND_GREEN = '#16a34a'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline support. The service worker is only built for production
    // (`npm run build && npm run preview`); `npm run dev` runs without it.
    VitePWA({
      // Ask before switching to a new version, rather than reloading mid-workout.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'gains-train',
        short_name: 'gains-train',
        description: 'Log your lifts. Watch the numbers go up.',
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
        // The app itself (JS, CSS, HTML, icons) is cached up front: it opens instantly and
        // without a connection.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // App routes (/workout, /history/…) all serve index.html, but API calls never do.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Exercise photos never change: cache each one the first time it's shown.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/exercise-images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 2000, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Your data: always fetched fresh, but the last copy is kept so the app still
            // opens and shows your workout, history and "last time" numbers offline. Only
            // successful responses are kept (a 401 after signing out never is), sign-in
            // endpoints are never cached, and the cache is cleared on sign-out.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // Proxy API calls to FastAPI so the browser sees one origin (simpler cookies, no CORS).
    proxy: { '/api': 'http://localhost:8001' },
  },
  preview: {
    host: true,
    proxy: { '/api': 'http://localhost:8001' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Must exceed Testing Library's asyncUtilTimeout (5s, see src/test/setup.ts).
    testTimeout: 15_000,
  },
})
