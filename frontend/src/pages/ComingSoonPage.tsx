import { Link } from 'react-router-dom'

/** Placeholder for tabs whose features are still being built. */
export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-sm text-neutral-500">{description}</p>
      <Link to="/exercises" className="btn mt-2">
        Browse exercises
      </Link>
    </section>
  )
}

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
