import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold">This track leads nowhere</h1>
      <Link to="/" className="btn">
        Back to the station
      </Link>
    </section>
  )
}
