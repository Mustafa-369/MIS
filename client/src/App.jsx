import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setStatus(data)
        } else {
          setError(data.error || 'Unknown error')
        }
      })
      .catch((err) => setError(err.message))
  }, [])

  return (
    <main className="container">
      <h1>AOP Walking Skeleton</h1>

      {!status && !error && <p>Checking status…</p>}

      {error && (
        <div className="error-box">
          <strong>Something went wrong</strong>
          <p>{error}</p>
        </div>
      )}

      {status && (
        <p className="success">
          AOP is alive — database says: {status.message} (server time {status.dbTime})
        </p>
      )}
    </main>
  )
}
