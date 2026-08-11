import { useEffect, useState } from 'react'
import { fetchLocations } from './features/foundation/foundationApi.js'

export default function App() {
  const [locations, setLocations] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchLocations()
      .then(setLocations)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <main className="container">
      <h1>AOP — Foundation</h1>

      {!locations && !error && <p>Loading locations…</p>}

      {error && (
        <div className="error-box">
          <strong>Something went wrong</strong>
          <p>{error}</p>
        </div>
      )}

      {locations && (
        <ul className="location-list">
          {locations.map((loc) => (
            <li key={loc.id}>
              <strong>{loc.code}</strong> — {loc.name} ({loc.kind})
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
