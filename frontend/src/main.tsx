import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { syncWithLibrary } from './data/migrate'
import './index.css'
import { routes } from './routes'

const router = createBrowserRouter(routes)

// Keep your data in step with this version's exercise library (see data/migrate.ts).
syncWithLibrary().catch((e: unknown) => console.warn('Exercise library sync failed', e))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
