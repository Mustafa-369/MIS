import { pool } from '../../db/pool.js'

const TABLES = {
  role: 'role',
  location: 'location',
  department: 'department',
  position: 'job_position',
  costCenter: 'cost_center',
  workCenter: 'work_center',
}

async function list(table) {
  const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY id`)
  return rows
}

async function getById(table, id) {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
  return rows[0] ?? null
}

export const foundationModel = {
  listRoles: () => list(TABLES.role),
  getRole: (id) => getById(TABLES.role, id),
  listLocations: () => list(TABLES.location),
  getLocation: (id) => getById(TABLES.location, id),
  listDepartments: () => list(TABLES.department),
  getDepartment: (id) => getById(TABLES.department, id),
  listPositions: () => list(TABLES.position),
  getPosition: (id) => getById(TABLES.position, id),
  listCostCenters: () => list(TABLES.costCenter),
  getCostCenter: (id) => getById(TABLES.costCenter, id),
  listWorkCenters: () => list(TABLES.workCenter),
  getWorkCenter: (id) => getById(TABLES.workCenter, id),
}
