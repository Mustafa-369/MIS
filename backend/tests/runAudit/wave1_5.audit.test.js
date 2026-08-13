import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { scalar, pool } from '../../src/lib/audit.js'

test('A21: app_user has columns email, password_hash, must_change_password', async () => {
  const [rows] = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'app_user'
       AND column_name IN ('email', 'password_hash', 'must_change_password')`,
  )
  const present = rows.map((r) => r.column_name || r.COLUMN_NAME).sort()
  assert.deepEqual(present, ['email', 'must_change_password', 'password_hash'])
})

test('A22: unique index on app_user.email exists', async () => {
  const n = await scalar(
    `SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'app_user'
       AND column_name = 'email' AND non_unique = 0`,
  )
  assert.ok(Number(n) > 0, 'expected a unique index covering app_user.email')
})

test('A23: password hashing round-trips', async () => {
  const password = 'correct-horse-battery-staple'
  const hash = await bcrypt.hash(password, 12)
  assert.equal(await bcrypt.compare(password, hash), true)
  assert.equal(await bcrypt.compare('wrong-password', hash), false)
})

after(async () => {
  await pool.end()
})
