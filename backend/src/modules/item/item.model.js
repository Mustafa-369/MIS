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

async function codeExists(conn, code) {
  const [[row]] = await conn.query('SELECT id FROM item WHERE code = ?', [code])
  return Boolean(row)
}

async function generateUniqueCode(conn) {
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM item')
  let seq = Number(n) + 1
  for (let attempt = 0; attempt < 1000; attempt++, seq++) {
    const candidate = `AUTO${String(seq).padStart(6, '0')}`
    if (!(await codeExists(conn, candidate))) return candidate
  }
  throw new Error('could not generate a unique item code')
}

async function insertItem(conn, { code, name, categoryId: catId, baseUomId, status, procurementMode }) {
  const [result] = await conn.query(
    `INSERT INTO item (code, name, category_id, base_uom_id, status, procurement_mode)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [code, name, catId, baseUomId, status, procurementMode],
  )
  return result.insertId
}

async function insertItemEnd(conn, itemId, end) {
  await conn.query(
    `INSERT INTO item_end
       (item_id, end_seq, connection_standard, size_value, size_basis, thread, gender, seal_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      itemId,
      end.end_seq,
      end.connection_standard,
      end.size_value,
      end.size_basis,
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

async function updateItemCode(conn, itemId, newCode) {
  await conn.query('UPDATE item SET code = ? WHERE id = ?', [newCode, itemId])
}

export const itemModel = {
  pool,
  categoryId,
  uomId,
  attributeId,
  optionId,
  fittingTypeOptionValues,
  codeExists,
  generateUniqueCode,
  insertItem,
  insertItemEnd,
  insertItemAttributeOption,
  updateItemCode,
}
