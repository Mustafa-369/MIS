import { useEffect, useState } from 'react'
import { fetchMe } from './authApi.js'

export default function HomePage({ onInvalidToken }) {
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((err) => {
        setError(err.message)
        onInvalidToken()
      })
  }, [onInvalidToken])

  if (error) {
    return null
  }

  return (
    <main className="container">
      <h1>AOP</h1>
      {!me && <p>Loading…</p>}
      {me && (
        <p>
          Signed in as {me.user.full_name || me.user.username} — roles: {me.roles.join(', ') || 'none'}.
        </p>
      )}
    </main>
  )
}
