import { pool } from '../../db/pool.js'

async function list(table) {
  const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY id`)
  return rows
}

async function getById(table, id) {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
  return rows[0] ?? null
}

export const workforceModel = {
  listCapabilities: () => list('capability'),
  getCapability: (id) => getById('capability', id),

  listEmployees: () => list('employee'),
  getEmployee: (id) => getById('employee', id),
  createEmployee: async ({ code, full_name }) => {
    const [result] = await pool.query(
      'INSERT INTO employee (code, full_name) VALUES (?, ?)',
      [code, full_name],
    )
    return getById('employee', result.insertId)
  },

  listAppUsers: () => list('app_user'),
  getAppUser: (id) => getById('app_user', id),
  createAppUser: async ({ employee_id, username }) => {
    const [result] = await pool.query(
      'INSERT INTO app_user (employee_id, username) VALUES (?, ?)',
      [employee_id, username],
    )
    return getById('app_user', result.insertId)
  },

  listMachines: () => list('machine'),
  getMachine: (id) => getById('machine', id),

  listEmployeePositions: async () => {
    const [rows] = await pool.query(
      'SELECT * FROM employee_position ORDER BY employee_id, job_position_id',
    )
    return rows
  },
  getEmployeePositionsByEmployee: async (employeeId) => {
    const [rows] = await pool.query(
      'SELECT * FROM employee_position WHERE employee_id = ? ORDER BY job_position_id',
      [employeeId],
    )
    return rows
  },
  createEmployeePosition: async ({ employee_id, job_position_id, is_primary }) => {
    await pool.query(
      'INSERT INTO employee_position (employee_id, job_position_id, is_primary) VALUES (?, ?, ?)',
      [employee_id, job_position_id, is_primary ? 1 : 0],
    )
    return workforceModel.getEmployeePositionsByEmployee(employee_id)
  },
}
