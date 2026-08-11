import { pool } from '../db/pool.js'

export async function scalar(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  const row = rows[0]
  return row ? Object.values(row)[0] : null
}

export { pool }
