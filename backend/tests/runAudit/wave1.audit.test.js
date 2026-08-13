import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { scalar, pool } from '../../src/lib/audit.js'

test('A11: exactly nine roles (7 + engineer + store)', async () => {
  const n = await scalar('SELECT COUNT(*) FROM role')
  assert.equal(Number(n), 9)
})

test('A12: department active/dormant set is exactly as decided', async () => {
  const activeExpected = ['CORP', 'MFG', 'QA', 'ENG', 'HOSE', 'WH', 'TOOL', 'SALES', 'PROC', 'ACCT']
  const dormantExpected = ['SEC', 'PPC', 'PROCENG', 'MAINT', 'RND', 'DOC', 'MDM', 'WF', 'XF', 'SCM']

  const [activeRows] = await pool.query(
    "SELECT code FROM department WHERE is_active=1 ORDER BY code",
  )
  const [dormantRows] = await pool.query(
    "SELECT code FROM department WHERE is_active=0 ORDER BY code",
  )
  const active = activeRows.map((r) => r.code).sort()
  const dormant = dormantRows.map((r) => r.code).sort()

  assert.deepEqual(active, [...activeExpected].sort(), 'active department set mismatch')
  assert.deepEqual(dormant, [...dormantExpected].sort(), 'dormant department set mismatch')
})

test('A13: exactly twenty job positions', async () => {
  const n = await scalar('SELECT COUNT(*) FROM job_position')
  assert.equal(Number(n), 20)
})

test('A14: every job_position.reports_to resolves (except BOARD, which is NULL)', async () => {
  const dangling = await scalar(`
    SELECT COUNT(*) FROM job_position p
    LEFT JOIN job_position parent ON parent.id = p.reports_to
    WHERE p.reports_to IS NOT NULL AND parent.id IS NULL
  `)
  assert.equal(Number(dangling), 0)

  const boardReportsTo = await scalar("SELECT reports_to FROM job_position WHERE code='BOARD'")
  assert.equal(boardReportsTo, null)
})

test('A15: every active department has a head_position_id that resolves', async () => {
  const missing = await scalar(`
    SELECT COUNT(*) FROM department d
    LEFT JOIN job_position p ON p.id = d.head_position_id
    WHERE d.is_active=1 AND (d.head_position_id IS NULL OR p.id IS NULL)
  `)
  assert.equal(Number(missing), 0)
})

test('A16: every position_role row resolves to a real position and role', async () => {
  const positionOrphans = await scalar(`
    SELECT COUNT(*) FROM position_role pr
    LEFT JOIN job_position p ON p.id = pr.position_id
    WHERE p.id IS NULL
  `)
  const roleOrphans = await scalar(`
    SELECT COUNT(*) FROM position_role pr
    LEFT JOIN role r ON r.id = pr.role_id
    WHERE r.id IS NULL
  `)
  assert.equal(Number(positionOrphans), 0, 'position_role.position_id orphans')
  assert.equal(Number(roleOrphans), 0, 'position_role.role_id orphans')
})

test('A17: exactly thirty-nine machines', async () => {
  const n = await scalar('SELECT COUNT(*) FROM machine')
  assert.equal(Number(n), 39)
})

test('A18: exactly two machines excluded from OEE (AQ21, AQ22)', async () => {
  const n = await scalar('SELECT COUNT(*) FROM machine WHERE oee_excluded=1')
  assert.equal(Number(n), 2)

  const [rows] = await pool.query("SELECT code FROM machine WHERE oee_excluded=1 ORDER BY code")
  assert.deepEqual(rows.map((r) => r.code), ['AQ21', 'AQ22'])
})

// Relaxed in Wave 1.5: these tables asserted empty through Wave 1, but the
// bootstrap-admin script now puts the first real rows in them. Emptiness is
// no longer an invariant, so this only asserts the tables exist — otherwise
// the first re-deploy after bootstrap would falsely fail (same kind of
// stale-assertion fix as A4/A5).
test('A19: employee, app_user, employee_position tables exist', async () => {
  const [employeeTables] = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('employee', 'app_user', 'employee_position')",
  )
  assert.equal(Number(employeeTables[0].n), 3, 'expected employee, app_user, employee_position to all exist')
})

test('A20: self-reference guard: no job_position.reports_to = id', async () => {
  const selfRef = await scalar('SELECT COUNT(*) FROM job_position WHERE reports_to = id')
  assert.equal(Number(selfRef), 0)

  await assert.rejects(
    pool.query(
      "INSERT INTO job_position (id, code, title, department_id, reports_to, authority_level) SELECT 999999999, 'TEST_SELF_POS', 'Self-report insert test', d.id, 999999999, 0 FROM department d LIMIT 1",
    ),
    /report to itself/i,
    'BEFORE INSERT trigger did not block a self-reporting row',
  )

  const [[existing]] = await pool.query(
    "SELECT id FROM job_position WHERE code='CNCOP' LIMIT 1",
  )
  await assert.rejects(
    pool.query('UPDATE job_position SET reports_to = ? WHERE id = ?', [existing.id, existing.id]),
    /report to itself/i,
    'BEFORE UPDATE trigger did not block a self-reporting row',
  )
})

after(async () => {
  await pool.end()
})
