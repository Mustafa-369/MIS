import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../../src/lib/audit.js'
import { importHoseOrEndFittingItem } from '../../src/modules/item/item.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'wave2_hose_import_expected.json'), 'utf8'),
)

// Imported results, in fixture order. Several fixture rows have a blank
// code (auto-generated), so results are tracked by index, not by code.
const imported = []

before(async () => {
  // Idempotent across repeated audit runs: clear any rows this suite
  // created on a previous run (by name, since auto-generated codes differ
  // run to run) before re-importing.
  const names = fixture.items.map((fx) => fx.input.desc)
  await pool.query('DELETE FROM item WHERE name IN (?)', [names])

  for (const fx of fixture.items) {
    const result = await importHoseOrEndFittingItem({
      kind: fx.kind,
      code: fx.input.code,
      description: fx.input.desc,
    })
    imported.push(result)
  }
})

async function loadItem(itemId) {
  const [[row]] = await pool.query(
    `SELECT i.code, i.name, ic.code AS category, uom.code AS uom_code, uom.name AS uom_name,
            m.code AS material_code, i.status, i.is_manufacturable
     FROM item i
     JOIN item_category ic ON ic.id = i.category_id
     JOIN unit_of_measure uom ON uom.id = i.base_uom_id
     LEFT JOIN material m ON m.id = i.material_id
     WHERE i.id = ?`,
    [itemId],
  )
  return row
}

async function loadEnds(itemId) {
  const [rows] = await pool.query(
    `SELECT end_seq, end_kind, connection_standard, size_value, size_dash, thread, gender, seal_type
     FROM item_end WHERE item_id = ? ORDER BY end_seq`,
    [itemId],
  )
  return rows
}

async function loadAttributes(itemId) {
  const [rows] = await pool.query(
    `SELECT ad.code AS attribute, iav.value_num, ao.value AS value_option
     FROM item_attribute_value iav
     JOIN attribute_definition ad ON ad.id = iav.attribute_id
     LEFT JOIN attribute_option ao ON ao.id = iav.value_option_id
     WHERE iav.item_id = ?`,
    [itemId],
  )
  return rows
}

function assertUom(row, expected) {
  const ok =
    row.uom_code.toLowerCase() === expected.toLowerCase() || row.uom_name.toLowerCase() === expected.toLowerCase()
  assert.ok(ok, `expected base_uom "${expected}", got code="${row.uom_code}" name="${row.uom_name}"`)
}

function assertMaterial(row, expected) {
  if (expected === null) {
    assert.equal(row.material_code, null)
    return
  }
  assert.ok(row.material_code, `expected material "${expected}", got none`)
  assert.equal(row.material_code.toLowerCase(), expected.toLowerCase())
}

fixture.items.forEach((fx, i) => {
  const label = `${fx.kind} ${fx.input.code || '(auto)'}`

  test(`W2H-ITEM ${label}: item row matches fixture`, async () => {
    const row = await loadItem(imported[i].itemId)
    assert.ok(row, `item for "${fx.input.desc}" was not imported`)
    const expected = fx.expected_item
    if (expected.code === '(auto)') {
      assert.ok(row.code && row.code.length > 0, 'generated code must be non-empty')
    } else {
      assert.equal(row.code, expected.code)
    }
    assert.equal(row.name, expected.name)
    assert.equal(row.category, expected.category)
    assertUom(row, expected.base_uom)
    assertMaterial(row, expected.material)
    assert.equal(row.status, expected.status)
    if ('is_manufacturable' in expected) {
      assert.equal(row.is_manufacturable, expected.is_manufacturable)
    }
  })

  test(`W2H-ITEM ${label}: item_end rows match fixture`, async () => {
    const ends = await loadEnds(imported[i].itemId)
    assert.equal(ends.length, fx.expected_ends.length, `end count mismatch for ${label}`)
    fx.expected_ends.forEach((expectedEnd, j) => {
      const actual = ends[j]
      for (const key of Object.keys(expectedEnd)) {
        if (key === 'note') continue
        assert.equal(actual[key], expectedEnd[key], `${label} end ${j + 1} field ${key}`)
      }
    })
  })

  test(`W2H-ITEM ${label}: item_attribute_value rows match fixture`, async () => {
    const values = await loadAttributes(imported[i].itemId)
    assert.equal(values.length, fx.expected_attributes.length, `attribute count mismatch for ${label}`)
    for (const [code, value, type] of fx.expected_attributes) {
      const actual = values.find((v) => v.attribute === code)
      assert.ok(actual, `${label} missing attribute ${code}`)
      if (type === 'option') {
        assert.equal(actual.value_option, value, `${label} attribute ${code} value`)
      } else if (type === 'number') {
        assert.equal(Number(actual.value_num), value, `${label} attribute ${code} value`)
      }
    }
  })
})

test('W2H-AGG: aggregate assertions', async () => {
  const agg = fixture.aggregate_assertions
  const itemIds = imported.map((r) => r.itemId)

  assert.equal(itemIds.length, agg.item_rows)

  const hoseCount = fixture.items.filter((fx) => fx.kind === 'hose').length
  const endFittingCount = fixture.items.filter((fx) => fx.kind === 'endfitting').length
  assert.equal(hoseCount, agg.hoses)
  assert.equal(endFittingCount, agg.end_fittings)

  const [[{ n: endRows }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end WHERE item_id IN (?)`,
    [itemIds],
  )
  assert.equal(Number(endRows), agg.item_end_rows)

  const [[{ n: hoseEnds }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end WHERE item_id IN (?) AND end_kind = 'hose'`,
    [itemIds],
  )
  assert.equal(Number(hoseEnds), agg.hose_ends)

  const [[{ n: connEnds }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end WHERE item_id IN (?) AND end_kind = 'connection'`,
    [itemIds],
  )
  assert.equal(Number(connEnds), agg.connection_ends)

  const [standardRows] = await pool.query(
    `SELECT connection_standard AS standard, COUNT(*) AS n FROM item_end
     WHERE item_id IN (?) AND end_kind = 'connection' GROUP BY connection_standard`,
    [itemIds],
  )
  const byStandard = Object.fromEntries(standardRows.map((r) => [r.standard, Number(r.n)]))
  for (const [standard, expectedCount] of Object.entries(agg.connection_ends_by_standard)) {
    assert.equal(byStandard[standard] || 0, expectedCount, `connection_ends_by_standard.${standard}`)
  }

  const [[{ n: hoseRows }]] = await pool.query('SELECT COUNT(*) AS n FROM item WHERE id IN (?)', [itemIds])
  assert.equal(Number(hoseRows), agg.item_rows)

  const autoCount = fixture.items.filter((fx) => fx.input.code === null).length
  assert.equal(autoCount, agg.auto_generated_codes)
})

test('W2H-NEG-1: hoses have zero item_end rows', async () => {
  for (let i = 0; i < fixture.items.length; i++) {
    if (fixture.items[i].kind !== 'hose') continue
    const ends = await loadEnds(imported[i].itemId)
    assert.equal(ends.length, 0, `hose "${fixture.items[i].input.desc}" must have zero item_end rows`)
  }
})

test('W2H-NEG-2: every end-fitting has exactly one hose end and one connection end', async () => {
  for (let i = 0; i < fixture.items.length; i++) {
    if (fixture.items[i].kind !== 'endfitting') continue
    const ends = await loadEnds(imported[i].itemId)
    const hoseEnds = ends.filter((e) => e.end_kind === 'hose')
    const connEnds = ends.filter((e) => e.end_kind === 'connection')
    assert.equal(hoseEnds.length, 1, `endfitting "${fixture.items[i].input.desc}" must have exactly 1 hose end`)
    assert.equal(connEnds.length, 1, `endfitting "${fixture.items[i].input.desc}" must have exactly 1 connection end`)
  }
})

test('W2H-NEG-3: bore is the canonical dash number (1/2" hose and 1/2" fitting hose-end both dash 8)', async () => {
  const hoseIdx = fixture.items.findIndex((fx) => fx.kind === 'hose' && fx.input.code === 'H01215012')
  const hoseAttrs = await loadAttributes(imported[hoseIdx].itemId)
  const bore = hoseAttrs.find((a) => a.attribute === 'bore')
  assert.equal(Number(bore.value_num), 8)

  const efIdx = fixture.items.findIndex(
    (fx) => fx.kind === 'endfitting' && fx.input.desc === 'Single-pc Female BSP 1/2 x 1/2 Straight',
  )
  const efEnds = await loadEnds(imported[efIdx].itemId)
  const hoseEnd = efEnds.find((e) => e.end_kind === 'hose')
  assert.equal(hoseEnd.size_dash, 8)
})

test('W2H-NEG-4: no pressure_rating attribute is ever written on a fitting from this fixture', async () => {
  const itemIds = imported.map((r) => r.itemId)
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_attribute_value iav
     JOIN attribute_definition ad ON ad.id = iav.attribute_id
     WHERE iav.item_id IN (?) AND ad.code = 'pressure_rating'`,
    [itemIds],
  )
  assert.equal(Number(n), 0)
})

test('W2H-NEG-5: NPT end is connection_standard=npt, never bspt', async () => {
  const i = fixture.items.findIndex((fx) => fx.input.desc === '1+1 Male NPT 1/2 x 1/2 Straight')
  const ends = await loadEnds(imported[i].itemId)
  const conn = ends.find((e) => e.end_kind === 'connection')
  assert.equal(conn.connection_standard, 'npt')
  assert.notEqual(conn.connection_standard, 'bspt')
})

test('W2H-NEG-6: Camlock -> camlock, Flange -> sae_flange (typed, not free text)', async () => {
  const camlockIdx = fixture.items.findIndex((fx) => fx.input.desc === 'Camlock A SS304 1"')
  const camlockEnds = await loadEnds(imported[camlockIdx].itemId)
  assert.equal(camlockEnds.find((e) => e.end_kind === 'connection').connection_standard, 'camlock')

  const flangeIdx = fixture.items.findIndex((fx) => fx.input.desc === 'ASA 150 Flange SS304 1"')
  const flangeEnds = await loadEnds(imported[flangeIdx].itemId)
  assert.equal(flangeEnds.find((e) => e.end_kind === 'connection').connection_standard, 'sae_flange')
})

test('W2H-NEG-7: source codes kept verbatim; un-coded rows get a generated code', async () => {
  const h1 = fixture.items.findIndex((fx) => fx.input.code === 'H01214006')
  assert.equal((await loadItem(imported[h1].itemId)).code, 'H01214006')

  const h2 = fixture.items.findIndex((fx) => fx.input.code === 'PH370-16')
  assert.equal((await loadItem(imported[h2].itemId)).code, 'PH370-16')

  const existingCodes = new Set(fixture.items.filter((fx) => fx.input.code).map((fx) => fx.input.code))
  for (let i = 0; i < fixture.items.length; i++) {
    if (fixture.items[i].input.code) continue
    const row = await loadItem(imported[i].itemId)
    assert.ok(row.code && !existingCodes.has(row.code), 'generated code must be non-empty and unique')
  }
})

after(async () => {
  await pool.end()
})
