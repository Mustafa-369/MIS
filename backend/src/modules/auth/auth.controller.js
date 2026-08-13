import { authService } from './auth.service.js'

async function login(req, res) {
  try {
    const result = await authService.login(req.body || {})
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal error' })
  }
}

async function changePassword(req, res) {
  try {
    await authService.changePassword(req.user, req.body || {})
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal error' })
  }
}

async function me(req, res) {
  try {
    const result = await authService.me(req.user)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Internal error' })
  }
}

export const authController = { login, changePassword, me }
