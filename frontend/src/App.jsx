import { useState } from 'react'
import { getToken, clearToken } from './features/auth/authApi.js'
import LoginPage from './features/auth/LoginPage.jsx'
import ChangePasswordPage from './features/auth/ChangePasswordPage.jsx'
import HomePage from './features/auth/HomePage.jsx'

export default function App() {
  const [page, setPage] = useState(() => (getToken() ? 'home' : 'login'))

  function handleLoggedIn(mustChangePassword) {
    setPage(mustChangePassword ? 'change-password' : 'home')
  }

  function handlePasswordChanged() {
    setPage('home')
  }

  function handleInvalidToken() {
    clearToken()
    setPage('login')
  }

  if (page === 'change-password') {
    return <ChangePasswordPage onChanged={handlePasswordChanged} />
  }
  if (page === 'home') {
    return <HomePage onInvalidToken={handleInvalidToken} />
  }
  return <LoginPage onLoggedIn={handleLoggedIn} />
}
