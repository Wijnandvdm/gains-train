import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn">
        Go home
      </Link>
    </section>
  )
}
