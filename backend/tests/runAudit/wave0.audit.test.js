import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { scalar, pool } from '../../src/lib/audit.js'

test('A1: exactly two root sites', async () => {
  const n = await scalar(
    "SELECT COUNT(*) FROM location WHERE kind='site' AND parent_id IS NULL",
  )
  assert.equal(Number(n), 2)
})

test('A2: exactly four work centres', async () => {
  const n = await scalar('SELECT COUNT(*) FROM work_center')
  assert.equal(Number(n), 4)
})

test('A3: work centre metric mapping', async () => {
  const expected = {
    cnc: 'oee',
    manual_turning: 'utilisation',
    hose_unit1: 'yield',
    hose_unit2: 'yield',
  }
  const [rows] = await pool.query('SELECT kind, metric_mode FROM work_center')
  for (const row of rows) {
    assert.equal(row.metric_mode, expected[row.kind], `kind=${row.kind}`)
  }
})

test('A4: exactly seven roles', async () => {
  const n = await scalar('SELECT COUNT(*) FROM role')
  assert.equal(Number(n), 7)
})

test('A5: exactly seventeen departments', async () => {
  const n = await scalar('SELECT COUNT(*) FROM department')
  assert.equal(Number(n), 17)
})

test('A6: no orphaned foreign keys', async () => {
  const costCenterOrphans = await scalar(`
    SELECT COUNT(*) FROM cost_center cc
    LEFT JOIN department d ON d.id = cc.department_id
    WHERE d.id IS NULL
  `)
  const positionOrphans = await scalar(`
    SELECT COUNT(*) FROM position p
    LEFT JOIN department d ON d.id = p.department_id
    WHERE d.id IS NULL
  `)
  const positionRolePositionOrphans = await scalar(`
    SELECT COUNT(*) FROM position_role pr
    LEFT JOIN position p ON p.id = pr.position_id
    WHERE p.id IS NULL
  `)
  const positionRoleRoleOrphans = await scalar(`
    SELECT COUNT(*) FROM position_role pr
    LEFT JOIN role r ON r.id = pr.role_id
    WHERE r.id IS NULL
  `)
  assert.equal(Number(costCenterOrphans), 0, 'cost_center.department_id orphans')
  assert.equal(Number(positionOrphans), 0, 'position.department_id orphans')
  assert.equal(Number(positionRolePositionOrphans), 0, 'position_role.position_id orphans')
  assert.equal(Number(positionRoleRoleOrphans), 0, 'position_role.role_id orphans')
})

test('A7: no self-referencing or dangling location parents', async () => {
  const selfRef = await scalar('SELECT COUNT(*) FROM location WHERE parent_id = id')
  const dangling = await scalar(`
    SELECT COUNT(*) FROM location l
    LEFT JOIN location p ON p.id = l.parent_id
    WHERE l.parent_id IS NOT NULL AND p.id IS NULL
  `)
  assert.equal(Number(selfRef), 0, 'self-referencing parent_id')
  assert.equal(Number(dangling), 0, 'dangling parent_id')
})

test('A8: no duplicate codes', async () => {
  const tables = ['role', 'location', 'department', 'position', 'cost_center', 'work_center']
  for (const t of tables) {
    const dupes = await scalar(`
      SELECT COUNT(*) FROM (
        SELECT code FROM ${t} GROUP BY code HAVING COUNT(*) > 1
      ) d
    `)
    assert.equal(Number(dupes), 0, `duplicate code in ${t}`)
  }
})

test('A9: no null created_at', async () => {
  const tables = [
    'role',
    'location',
    'department',
    'position',
    'position_role',
    'cost_center',
    'work_center',
  ]
  for (const t of tables) {
    const nulls = await scalar(`SELECT COUNT(*) FROM ${t} WHERE created_at IS NULL`)
    assert.equal(Number(nulls), 0, `null created_at in ${t}`)
  }
})

after(async () => {
  await pool.end()
})
