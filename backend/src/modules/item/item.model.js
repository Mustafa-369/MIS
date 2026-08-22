import { pool } from '../../db/pool.js'

async function categoryId(conn, code) {
  const [[row]] = await conn.query('SELECT id FROM item_category WHERE code = ?', [code])
  if (!row) throw new Error(`unknown item_category code: ${code}`)
  return row.id
}

async function uomId(conn, code) {
  const [[row]] = await conn.query('SELECT id FROM unit_of_measure WHERE code = ?', [code])
  if (!row) throw new Error(`unknown unit_of_measure code: ${code}`)
  return row.id
}

async function attributeId(conn, code) {
  const [[row]] = await conn.query('SELECT id FROM attribute_definition WHERE code = ?', [code])
  if (!row) throw new Error(`unknown attribute_definition code: ${code}`)
  return row.id
}

async function optionId(conn, attrId, value) {
  const [[row]] = await conn.query(
    'SELECT id FROM attribute_option WHERE attribute_id = ? AND value = ?',
    [attrId, value],
  )
  if (!row) throw new Error(`unknown attribute_option value "${value}" for attribute ${attrId}`)
  return row.id
}

async function fittingTypeOptionValues(conn) {
  const [rows] = await conn.query(
    `SELECT ao.value FROM attribute_option ao
     JOIN attribute_definition ad ON ad.id = ao.attribute_id
     WHERE ad.code = 'fitting_type'`,
  )
  return rows.map((r) => r.value)
}

async function optionValues(conn, attributeCode) {
  const [rows] = await conn.query(
    `SELECT ao.value FROM attribute_option ao
     JOIN attribute_definition ad ON ad.id = ao.attribute_id
     WHERE ad.code = ?`,
    [attributeCode],
  )
  return rows.map((r) => r.value)
}

async function materialId(conn, code) {
  if (!code) return null
  const [[row]] = await conn.query('SELECT id FROM material WHERE code = ?', [code])
  if (!row) throw new Error(`unknown material code: ${code}`)
  return row.id
}

async function dashForInch(conn, inchLabel) {
  const [[row]] = await conn.query('SELECT dash FROM size_reference WHERE inch = ?', [inchLabel])
  if (!row) throw new Error(`unknown size_reference inch label: ${inchLabel}`)
  return row.dash
}

async function codeExists(conn, code) {
  const [[row]] = await conn.query('SELECT id FROM item WHERE code = ?', [code])
  return Boolean(row)
}

async function generateUniqueCode(conn) {
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM item')
  // Jitter the starting point so two concurrent callers (e.g. two importer
  // calls racing on the same connection pool) don't compute the same
  // candidate from the same COUNT(*) and collide on insert.
  let seq = Number(n) + 1 + Math.floor(Math.random() * 20)
  for (let attempt = 0; attempt < 1000; attempt++, seq++) {
    const candidate = `AUTO${String(seq).padStart(6, '0')}`
    if (!(await codeExists(conn, candidate))) return candidate
  }
  throw new Error('could not generate a unique item code')
}

async function insertItem(
  conn,
  { code, name, categoryId: catId, baseUomId, status, procurementMode, materialId: matId = null, isManufacturable = 0 },
) {
  const [result] = await conn.query(
    `INSERT INTO item (code, name, category_id, base_uom_id, status, procurement_mode, material_id, is_manufacturable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, name, catId, baseUomId, status, procurementMode, matId, isManufacturable],
  )
  return result.insertId
}

async function insertItemEnd(conn, itemId, end) {
  await conn.query(
    `INSERT INTO item_end
       (item_id, end_seq, end_kind, connection_standard, size_value, size_basis, size_dash, thread, gender, seal_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      itemId,
      end.end_seq,
      end.end_kind || 'connection',
      end.connection_standard,
      end.size_value,
      end.size_basis,
      end.size_dash ?? null,
      end.thread,
      end.gender,
      end.seal_type,
    ],
  )
}

async function insertItemAttributeOption(conn, itemId, attrId, optId) {
  await conn.query(
    `INSERT INTO item_attribute_value (item_id, attribute_id, value_option_id) VALUES (?, ?, ?)`,
    [itemId, attrId, optId],
  )
}

async function insertItemAttributeNumber(conn, itemId, attrId, numValue) {
  await conn.query(
    `INSERT INTO item_attribute_value (item_id, attribute_id, value_num) VALUES (?, ?, ?)`,
    [itemId, attrId, numValue],
  )
}

async function updateItemCode(conn, itemId, newCode) {
  await conn.query('UPDATE item SET code = ? WHERE id = ?', [newCode, itemId])
}

export const itemModel = {
  pool,
  categoryId,
  uomId,
  attributeId,
  optionId,
  optionValues,
  fittingTypeOptionValues,
  materialId,
  dashForInch,
  codeExists,
  generateUniqueCode,
  insertItem,
  insertItemEnd,
  insertItemAttributeOption,
  insertItemAttributeNumber,
  updateItemCode,
}
