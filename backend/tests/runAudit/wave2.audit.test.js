import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../../src/lib/audit.js'
import { importFittingItem, updateItemCode } from '../../src/modules/item/item.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'wave2_item_import_expected.json'), 'utf8'),
)

const AUTOCODE_DESC = fixture.autocode_test.input.description

// Imported item ids, keyed by code, so every test can query the DB rows
// without re-importing (the importer itself is only exercised once).
const importedByCode = new Map()
let autocodeResult = null

before(async () => {
  // Idempotent across repeated audit runs on a persistent DB: clear any rows
  // this suite created on a previous run before re-importing.
  const codes = fixture.items.map((i) => i.code)
  await pool.query('DELETE FROM item WHERE code IN (?) OR name = ?', [codes, AUTOCODE_DESC])

  for (const fx of fixture.items) {
    const result = await importFittingItem({ code: fx.code, description: fx.desc })
    importedByCode.set(fx.code, result)
  }
  autocodeResult = await importFittingItem({ code: '', description: AUTOCODE_DESC })
})

async function loadItem(code) {
  const [[row]] = await pool.query(
    `SELECT i.code, i.name, ic.code AS category, i.material_id, uom.code AS base_uom,
            i.status, i.is_stockable, i.is_purchasable, i.is_sellable, i.is_manufacturable,
            i.critical, i.procurement_mode
     FROM item i
     JOIN item_category ic ON ic.id = i.category_id
     JOIN unit_of_measure uom ON uom.id = i.base_uom_id
     WHERE i.code = ?`,
    [code],
  )
  return row
}

async function loadEnds(itemId) {
  const [rows] = await pool.query(
    `SELECT end_seq, connection_standard, size_value, size_basis, thread, gender, seal_type
     FROM item_end WHERE item_id = ? ORDER BY end_seq`,
    [itemId],
  )
  return rows
}

async function loadAttributeValues(itemId) {
  const [rows] = await pool.query(
    `SELECT ad.code AS attribute, iav.value_num, iav.value_text, iav.value_bool,
            ao.value AS value_option
     FROM item_attribute_value iav
     JOIN attribute_definition ad ON ad.id = iav.attribute_id
     LEFT JOIN attribute_option ao ON ao.id = iav.value_option_id
     WHERE iav.item_id = ?`,
    [itemId],
  )
  return rows
}

for (const fx of fixture.items) {
  test(`W2-ITEM ${fx.code}: item row matches fixture`, async () => {
    const row = await loadItem(fx.code)
    assert.ok(row, `item with code ${fx.code} was not imported`)
    const expected = fx.expected_item
    assert.equal(row.code, expected.code)
    assert.equal(row.name, expected.name)
    assert.equal(row.category, expected.category)
    assert.equal(row.material_id, null)
    assert.equal(row.base_uom, expected.base_uom)
    assert.equal(row.status, expected.status)
    assert.equal(row.is_stockable, expected.is_stockable)
    assert.equal(row.is_purchasable, expected.is_purchasable)
    assert.equal(row.is_sellable, expected.is_sellable)
    assert.equal(row.is_manufacturable, expected.is_manufacturable)
    assert.equal(row.critical, expected.critical)
    assert.equal(row.procurement_mode, expected.procurement_mode)
  })

  test(`W2-ITEM ${fx.code}: item_end rows match fixture`, async () => {
    const { itemId } = importedByCode.get(fx.code)
    const ends = await loadEnds(itemId)
    assert.equal(ends.length, fx.ends.length, `end count mismatch for ${fx.code}`)
    fx.ends.forEach((expectedEnd, i) => {
      const actual = ends[i]
      assert.equal(actual.end_seq, expectedEnd.end_seq, `${fx.code} end ${i + 1} end_seq`)
      assert.equal(
        actual.connection_standard,
        expectedEnd.connection_standard,
        `${fx.code} end ${i + 1} connection_standard`,
      )
      assert.equal(actual.size_value, expectedEnd.size_value, `${fx.code} end ${i + 1} size_value`)
      assert.equal(actual.size_basis, expectedEnd.size_basis, `${fx.code} end ${i + 1} size_basis`)
      assert.equal(actual.thread, expectedEnd.thread, `${fx.code} end ${i + 1} thread`)
      assert.equal(actual.gender, expectedEnd.gender, `${fx.code} end ${i + 1} gender`)
      assert.equal(actual.seal_type, expectedEnd.seal_type, `${fx.code} end ${i + 1} seal_type`)
    })
  })

  test(`W2-ITEM ${fx.code}: item_attribute_value rows match fixture`, async () => {
    const { itemId } = importedByCode.get(fx.code)
    const values = await loadAttributeValues(itemId)
    assert.equal(values.length, fx.expected_attributes.length, `attribute count mismatch for ${fx.code}`)
    for (const expectedAttr of fx.expected_attributes) {
      const actual = values.find((v) => v.attribute === expectedAttr.attribute)
      assert.ok(actual, `${fx.code} missing attribute ${expectedAttr.attribute}`)
      assert.equal(actual.value_option, expectedAttr.value_option, `${fx.code} fitting_type value`)
      assert.equal(actual.value_num, null, `${fx.code} fitting_type must not use value_num`)
      assert.equal(actual.value_text, null, `${fx.code} fitting_type must not use value_text`)
      assert.equal(actual.value_bool, null, `${fx.code} fitting_type must not use value_bool`)
    }
  })
}

test('W2-AGG: aggregate assertions', async () => {
  const codes = fixture.items.map((i) => i.code)
  const agg = fixture.aggregate_assertions

  const [[{ n: itemRows }]] = await pool.query('SELECT COUNT(*) AS n FROM item WHERE code IN (?)', [codes])
  assert.equal(Number(itemRows), agg.item_rows)

  const [[{ n: nonFitting }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item i JOIN item_category ic ON ic.id = i.category_id
     WHERE i.code IN (?) AND ic.code != ?`,
    [codes, agg.all_category],
  )
  assert.equal(Number(nonFitting), 0)

  const [[{ n: endRows }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end ie JOIN item i ON i.id = ie.item_id WHERE i.code IN (?)`,
    [codes],
  )
  assert.equal(Number(endRows), agg.item_end_rows)

  const [[{ n: attrRows }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_attribute_value iav JOIN item i ON i.id = iav.item_id WHERE i.code IN (?)`,
    [codes],
  )
  assert.equal(Number(attrRows), agg.item_attribute_value_rows)

  const [standardRows] = await pool.query(
    `SELECT ie.connection_standard AS standard, COUNT(*) AS n
     FROM item_end ie JOIN item i ON i.id = ie.item_id
     WHERE i.code IN (?) GROUP BY ie.connection_standard`,
    [codes],
  )
  const byStandard = Object.fromEntries(standardRows.map((r) => [r.standard, Number(r.n)]))
  for (const [standard, expectedCount] of Object.entries(agg.ends_by_standard)) {
    assert.equal(byStandard[standard] || 0, expectedCount, `ends_by_standard.${standard}`)
  }
  assert.equal(byStandard.npt || 0, 0, 'no ends should be stored as npt in this fixture')

  const [[{ n: maleEnds }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end ie JOIN item i ON i.id = ie.item_id
     WHERE i.code IN (?) AND ie.gender = 'male'`,
    [codes],
  )
  assert.equal(Number(maleEnds), agg.gender_male_ends)

  const [[{ n: femaleEnds }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end ie JOIN item i ON i.id = ie.item_id
     WHERE i.code IN (?) AND ie.gender = 'female'`,
    [codes],
  )
  assert.equal(Number(femaleEnds), agg.gender_female_ends)

  const [[{ n: coneSeals }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end ie JOIN item i ON i.id = ie.item_id
     WHERE i.code IN (?) AND ie.seal_type = '24_cone'`,
    [codes],
  )
  assert.equal(Number(coneSeals), agg.seal_24_cone_ends)

  const [[{ n: edSeals }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end ie JOIN item i ON i.id = ie.item_id
     WHERE i.code IN (?) AND ie.seal_type = 'ed_oring'`,
    [codes],
  )
  assert.equal(Number(edSeals), agg.seal_ed_oring_ends)
})

test('W2-NEG-1: no dash size ever lands on a DIN end (size_basis is always tube_od_mm_series)', async () => {
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_end WHERE connection_standard = 'din_metric_dko' AND size_basis != 'tube_od_mm_series'`,
  )
  assert.equal(Number(n), 0)
})

test('W2-NEG-2: BSPT (R3/4 on WJ22L-12) is stored as bspt, never npt, never merged', async () => {
  const { itemId } = importedByCode.get('WJ22L-12')
  const ends = await loadEnds(itemId)
  const branch = ends.find((e) => e.size_value === 'R3/4')
  assert.ok(branch, 'R3/4 end not found on WJ22L-12')
  assert.equal(branch.connection_standard, 'bspt')
  assert.notEqual(branch.connection_standard, 'npt')
})

test('W2-NEG-3: fitting_type is stored in value_option_id, never value_text', async () => {
  const codes = fixture.items.map((i) => i.code)
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_attribute_value iav
     JOIN item i ON i.id = iav.item_id
     JOIN attribute_definition ad ON ad.id = iav.attribute_id
     WHERE i.code IN (?) AND ad.code = 'fitting_type' AND iav.value_text IS NOT NULL`,
    [codes],
  )
  assert.equal(Number(n), 0)
})

test('W2-NEG-4: WF35L-24 yields exactly 2 ends and WJ22L-12 exactly 3 (no silent-drop)', async () => {
  const wf = await loadEnds(importedByCode.get('WF35L-24').itemId)
  const wj = await loadEnds(importedByCode.get('WJ22L-12').itemId)
  assert.equal(wf.length, 2)
  assert.equal(wj.length, 3)
})

test('W2-NEG-5: codes are byte-for-byte preserved (no case-fold, no re-generation)', async () => {
  const row = await loadItem('WF35L-24')
  assert.equal(row.code, 'WF35L-24')
})

test('W2-NEG-6: no item gets a scalar that was not in its string', async () => {
  const codes = fixture.items.map((i) => i.code)
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item WHERE code IN (?) AND material_id IS NOT NULL`,
    [codes],
  )
  assert.equal(Number(n), 0)

  const [[{ n: extraAttrs }]] = await pool.query(
    `SELECT COUNT(*) AS n FROM item_attribute_value iav
     JOIN item i ON i.id = iav.item_id
     JOIN attribute_definition ad ON ad.id = iav.attribute_id
     WHERE i.code IN (?) AND ad.code != 'fitting_type'`,
    [codes],
  )
  assert.equal(Number(extraAttrs), 0, 'no unstated body attribute (pressure_rating/plating/...) should be created')
})

test('W2-AUTOCODE: blank code is auto-generated, unique, editable, and imports correctly', async () => {
  assert.ok(autocodeResult.code, 'generated code must be non-empty')

  const existingCodes = fixture.items.map((i) => i.code)
  assert.ok(!existingCodes.includes(autocodeResult.code), 'generated code must be unique vs existing codes')

  const newCode = `${autocodeResult.code}-EDITED`
  await updateItemCode(autocodeResult.itemId, newCode)
  const row = await loadItem(newCode)
  assert.ok(row, 'generated code was not editable to a new unique value')

  const ends = await loadEnds(autocodeResult.itemId)
  assert.equal(ends.length, 1)
  assert.equal(ends[0].connection_standard, 'bspp')
  assert.equal(ends[0].size_value, 'G1/4')
  assert.equal(ends[0].gender, 'male')
  assert.equal(ends[0].seal_type, 'ed_oring')

  const attrs = await loadAttributeValues(autocodeResult.itemId)
  const fittingType = attrs.find((a) => a.attribute === 'fitting_type')
  assert.equal(fittingType.value_option, 'Sealing Plug')
})

after(async () => {
  await pool.end()
})
