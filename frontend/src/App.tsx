import { useEffect, useState } from 'react'

function App() {
  const [health, setHealth] = useState('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { status: string; db: string }) =>
        setHealth(`api ${d.status}, db ${d.db}`),
      )
      .catch(() => setHealth('api unreachable'))
  }, [])

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-3xl font-bold">gains-train</h1>
      <p className="mt-2 text-gray-500">{health}</p>
    </main>
  )
}

export default App
