import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { UpdatePrompt } from './components/UpdatePrompt'
import { requestPersistentStorage } from './data/db'
import './index.css'
import { routes } from './routes'

const router = createBrowserRouter(routes)

// Your data only lives on this device: ask the browser not to clear it under storage pressure.
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <UpdatePrompt />
  </StrictMode>,
)
