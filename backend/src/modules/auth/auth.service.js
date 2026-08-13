import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../../config/index.js'
import { authModel } from './auth.model.js'

const BCRYPT_COST = 12
const TOKEN_EXPIRY = '12h'
const MIN_PASSWORD_LENGTH = 8

function authError(message, status = 401) {
  const err = new Error(message)
  err.status = status
  return err
}

async function login({ email, password }) {
  const user = email ? await authModel.findActiveByEmail(email) : null
  const valid = user?.password_hash
    ? await bcrypt.compare(password ?? '', user.password_hash)
    : false

  if (!user || !valid) {
    throw authError('Invalid email or password')
  }

  const token = jwt.sign(
    { user_id: user.id, employee_id: user.employee_id },
    config.jwtSecret,
    { expiresIn: TOKEN_EXPIRY },
  )

  await authModel.touchLastLogin(user.id)

  return {
    token,
    must_change_password: !!user.must_change_password,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      employee_id: user.employee_id,
    },
  }
}

async function changePassword(reqUser, { current_password, new_password }) {
  const user = await authModel.getUserWithEmployee(reqUser.id)
  const valid = user && (await bcrypt.compare(current_password ?? '', user.password_hash ?? ''))
  if (!valid) {
    throw authError('Current password is incorrect', 401)
  }
  if (!new_password || new_password.length < MIN_PASSWORD_LENGTH) {
    throw authError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400)
  }

  const passwordHash = await bcrypt.hash(new_password, BCRYPT_COST)
  await authModel.updatePasswordHash(user.id, passwordHash)
}

async function me(reqUser) {
  const roles = await authModel.getEffectiveRoles(reqUser.employee_id)
  return {
    user: {
      id: reqUser.id,
      username: reqUser.username,
      email: reqUser.email,
      employee_id: reqUser.employee_id,
      full_name: reqUser.employee_full_name,
    },
    roles: roles.map((r) => r.code),
  }
}

export const authService = {
  BCRYPT_COST,
  login,
  changePassword,
  me,
}
