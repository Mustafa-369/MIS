import { itemModel } from './item.model.js'
import { decodeFitting } from './item.decoder.js'

/**
 * Import one fitting row (code + description) into item / item_end /
 * item_attribute_value. code may be blank, in which case a unique code is
 * generated (D14) — the caller can edit it afterwards via updateItemCode.
 */
export async function importFittingItem({ code, description }) {
  const conn = await itemModel.pool.getConnection()
  try {
    await conn.beginTransaction()

    const fittingTypeOptions = await itemModel.fittingTypeOptionValues(conn)
    const decoded = decodeFitting({ code: code || null, description }, { fittingTypeOptions })

    const catId = await itemModel.categoryId(conn, decoded.category)
    const baseUomId = await itemModel.uomId(conn, decoded.base_uom)
    const fittingTypeAttrId = await itemModel.attributeId(conn, 'fitting_type')
    const fittingTypeOptId = await itemModel.optionId(conn, fittingTypeAttrId, decoded.fitting_type)

    const finalCode = decoded.code || (await itemModel.generateUniqueCode(conn))

    const itemId = await itemModel.insertItem(conn, {
      code: finalCode,
      name: decoded.name,
      categoryId: catId,
      baseUomId,
      status: decoded.status,
      procurementMode: decoded.procurement_mode,
    })

    for (const end of decoded.ends) {
      await itemModel.insertItemEnd(conn, itemId, end)
    }

    await itemModel.insertItemAttributeOption(conn, itemId, fittingTypeAttrId, fittingTypeOptId)

    await conn.commit()
    return { itemId, code: finalCode, fittingType: decoded.fitting_type, ends: decoded.ends }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function updateItemCode(itemId, newCode) {
  const conn = await itemModel.pool.getConnection()
  try {
    await itemModel.updateItemCode(conn, itemId, newCode)
  } finally {
    conn.release()
  }
}
