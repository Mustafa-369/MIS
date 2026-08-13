const TOKEN_KEY = 'aop_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function parseJsonResponse(res) {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return parseJsonResponse(res)
}

export async function changePassword(current_password, new_password) {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ current_password, new_password }),
  })
  return parseJsonResponse(res)
}

export async function fetchMe() {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  return parseJsonResponse(res)
}
