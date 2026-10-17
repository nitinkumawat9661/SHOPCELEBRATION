import { query, transaction } from "./db"
import { invalidatePublicSnapshot } from "./public-store-cache"

export type AdjustmentMode = "set" | "add" | "remove"

export class InventoryAdjustmentError extends Error {
  constructor(public readonly code: string, public readonly status: number = 422) {
    super(code)
  }
}

type Input = {
  requestId: unknown
  productId: unknown
  mode: unknown
  quantity: unknown
  expectedAvailable: unknown
  reason: unknown
}

type HistoryRow = {
  id: string
  request_id: string
  product_id: string
  mode: AdjustmentMode
  quantity_input: number
  expected_available: number
  previous_available: number
  new_available: number
  delta: number
  reason: string
  actor: string
  created_at: Date
}

type CatalogueRow = {
  payload: { products?: { id?: string; active?: boolean; sellIndividually?: boolean }[] }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

function quantity(value: unknown, code: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10000) {
    throw new InventoryAdjustmentError(code)
  }
  return value
}

function publicRecord(row: HistoryRow) {
  return {
    id: String(row.id), requestId: row.request_id, productId: row.product_id,
    mode: row.mode, quantity: row.quantity_input, expectedAvailable: row.expected_available,
    previousAvailable: row.previous_available, availableQuantity: row.new_available,
    delta: row.delta, reason: row.reason, actor: row.actor,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  }
}

/**
 * Available-to-sell stock only: reservations have ALREADY deducted available.
 * This is a single-transaction conditional change with an audit row, a
 * caller-provided expected value, and request-id idempotency.
 */
export async function applyAdminInventoryAdjustment(input: Input) {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : ""
  const productId = typeof input.productId === "string" ? input.productId.trim() : ""
  const mode = input.mode
  const value = quantity(input.quantity, "INVALID_STOCK_QUANTITY")
  const expected = quantity(input.expectedAvailable, "INVALID_EXPECTED_STOCK")
  const reason = typeof input.reason === "string" ? input.reason.trim() : ""

  if (!UUID_PATTERN.test(requestId)) throw new InventoryAdjustmentError("INVALID_REQUEST_ID")
  if (!ID_PATTERN.test(productId)) throw new InventoryAdjustmentError("INVALID_PRODUCT_ID")
  if (mode !== "set" && mode !== "add" && mode !== "remove") {
    throw new InventoryAdjustmentError("INVALID_ADJUSTMENT_MODE")
  }
  if (reason.length < 4 || reason.length > 240 || /[\u0000-\u001f\u007f]/.test(reason)) {
    throw new InventoryAdjustmentError("INVALID_ADJUSTMENT_REASON")
  }

  const outcome = await transaction(async (client) => {
    // Replays are serialized even across different SKUs. No duplicate stock
    // changes are allowed for the same client-generated idempotency key.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [requestId])
    const found = await client.query<HistoryRow>(
      "SELECT * FROM admin_inventory_adjustments WHERE request_id = $1::uuid", [requestId]
    )
    if (found.rows[0]) {
      const old = found.rows[0]
      if (old.product_id !== productId || old.mode !== mode || old.quantity_input !== value ||
          old.expected_available !== expected || old.reason !== reason) {
        throw new InventoryAdjustmentError("REQUEST_ID_REUSED", 409)
      }
      return { ...publicRecord(old), replayed: true }
    }

    // Hold the catalog's row share-lock to prevent an SKU from being disabled
    // or removed between sale-eligibility validation and quantity mutation.
    const live = await client.query<CatalogueRow>(
      "SELECT payload FROM catalog_config WHERE id = 'primary' FOR SHARE"
    )
    const product = live.rows[0]?.payload?.products?.find(p => p.id === productId)
    if (!product || product.active === false || product.sellIndividually !== true) {
      throw new InventoryAdjustmentError("PRODUCT_NOT_SELLABLE", 409)
    }

    const locked = await client.query<{ available_quantity: number }>(
      "SELECT available_quantity FROM product_inventory WHERE product_id = $1 FOR UPDATE", [productId]
    )
    if (!locked.rows[0]) {
      // Never insert an invented quantity: first initialize/repair inventory
      // using the existing catalog-inventory flow, then retry this request.
      throw new InventoryAdjustmentError("INVENTORY_ROW_MISSING", 409)
    }
    const previous = locked.rows[0].available_quantity
    if (previous !== expected) {
      throw new InventoryAdjustmentError("STOCK_CHANGED_RELOAD", 409)
    }
    const next = mode === "set" ? value : mode === "add" ? previous + value : previous - value
    if (!Number.isSafeInteger(next) || next < 0 || next > 10000) {
      throw new InventoryAdjustmentError("STOCK_OUT_OF_RANGE", 409)
    }
    if (next === previous) throw new InventoryAdjustmentError("NO_STOCK_CHANGE")

    await client.query(
      "UPDATE product_inventory SET available_quantity = $2, updated_at = now() WHERE product_id = $1",
      [productId, next]
    )
    const written = await client.query<HistoryRow>(
      `INSERT INTO admin_inventory_adjustments
         (request_id, product_id, mode, quantity_input, expected_available,
          previous_available, new_available, delta, reason)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [requestId, productId, mode, value, expected, previous, next, next - previous, reason]
    )
    if (!written.rows[0]) throw new InventoryAdjustmentError("INVENTORY_ADJUSTMENT_FAILED", 503)
    return { ...publicRecord(written.rows[0]), replayed: false }
  })

  if (!outcome.replayed) await invalidatePublicSnapshot("catalog")
  return outcome
}

export async function listAdminInventoryAdjustments(rawProductId: unknown, rawLimit: unknown = 40) {
  const productId = typeof rawProductId === "string" && rawProductId.trim()
    ? rawProductId.trim() : null
  if (productId !== null && !ID_PATTERN.test(productId)) {
    throw new InventoryAdjustmentError("INVALID_PRODUCT_ID")
  }
  const limit = Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new InventoryAdjustmentError("INVALID_HISTORY_LIMIT")
  }
  const rows = await query<HistoryRow>(
    `SELECT id, request_id, product_id, mode, quantity_input, expected_available,
            previous_available, new_available, delta, reason, actor, created_at
       FROM admin_inventory_adjustments
      WHERE ($1::text IS NULL OR product_id = $1)
      ORDER BY created_at DESC, id DESC
      LIMIT $2`, [productId, limit]
  )
  return rows.rows.map(publicRecord)
}
