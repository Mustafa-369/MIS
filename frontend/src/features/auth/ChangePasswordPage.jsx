import { useState } from 'react'
import { changePassword } from './authApi.js'

const MIN_PASSWORD_LENGTH = 8

export default function ChangePasswordPage({ onChanged }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="container">
      <h1>Set a new password</h1>
      <p>Your account password is temporary. Set a real password to continue.</p>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && (
          <div className="error-box">
            <strong>Could not change password</strong>
            <p>{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </main>
  )
}
