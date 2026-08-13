import jwt from 'jsonwebtoken'
import { config } from '../../config/index.js'
import { authModel } from './auth.model.js'

// Reads the bearer JWT, loads app_user + employee, and resolves the user's
// effective roles through their positions (WD-03: roles are the union of
// every seat an employee holds — employee -> employee_position ->
// job_position -> position_role -> role).
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const user = await authModel.getUserWithEmployee(payload.user_id)
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const roles = await authModel.getEffectiveRoles(user.employee_id)

  req.user = user
  req.roles = roles.map((r) => r.code)
  next()
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.roles?.includes(role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
