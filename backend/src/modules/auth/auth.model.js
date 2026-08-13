import { pool } from '../../db/pool.js'

async function findActiveByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM app_user WHERE email = ? AND is_active = 1',
    [email],
  )
  return rows[0] ?? null
}

async function getUserWithEmployee(id) {
  const [rows] = await pool.query(
    `SELECT app_user.*, employee.full_name AS employee_full_name
     FROM app_user
     JOIN employee ON employee.id = app_user.employee_id
     WHERE app_user.id = ?`,
    [id],
  )
  return rows[0] ?? null
}

async function getEffectiveRoles(employeeId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT r.id, r.code, r.name
     FROM employee_position ep
     JOIN job_position jp ON jp.id = ep.job_position_id
     JOIN position_role pr ON pr.position_id = jp.id
     JOIN role r ON r.id = pr.role_id
     WHERE ep.employee_id = ?
     ORDER BY r.code`,
    [employeeId],
  )
  return rows
}

async function touchLastLogin(id) {
  await pool.query('UPDATE app_user SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id])
}

async function updatePasswordHash(id, passwordHash) {
  await pool.query(
    'UPDATE app_user SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [passwordHash, id],
  )
}

export const authModel = {
  findActiveByEmail,
  getUserWithEmployee,
  getEffectiveRoles,
  touchLastLogin,
  updatePasswordHash,
}
