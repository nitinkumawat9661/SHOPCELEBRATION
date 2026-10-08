import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import type { CatalogConfig } from "../domain/catalog"
import type { OrderLineItem } from "../domain/order"
import { transaction } from "./db"

const RESERVATION_MINUTES = 30

async function releaseExpiredWithClient(client: PoolClient) {
  const expiredRows = await client.query<{ product_id: string; quantity: number }>(
    `SELECT product_id, quantity
       FROM inventory_reservations
      WHERE status = 'reserved' AND expires_at <= now()
      FOR UPDATE`
  )
  const totals = new Map<string, number>()
  for (const row of expiredRows.rows) totals.set(row.product_id, (totals.get(row.product_id) || 0) + row.quantity)
  for (const [productId, quantity] of totals) {
    await client.query(
      `UPDATE product_inventory
          SET available_quantity = available_quantity + $1, updated_at = now()
        WHERE product_id = $2`,
      [quantity, productId]
    )
  }
  if (expiredRows.rows.length) {
    await client.query(
      `UPDATE inventory_reservations
          SET status = 'released', updated_at = now()
        WHERE status = 'reserved' AND expires_at <= now()`
    )
  }
}

async function ensureCatalogRows(client: PoolClient, catalog: CatalogConfig) {
  const ids = catalog.products
    .filter((product) => product.active !== false && product.sellIndividually === true)
    .map((product) => product.id)
  if (!ids.length) return
  await client.query(
    `INSERT INTO product_inventory (product_id, available_quantity)
     SELECT unnest($1::text[]), 1
     ON CONFLICT (product_id) DO NOTHING`,
    [ids]
  )
}

export async function inventoryAvailabilityForCatalog(catalog: CatalogConfig) {
  return transaction(async (client) => {
    await releaseExpiredWithClient(client)
    await ensureCatalogRows(client, catalog)
    const ids = catalog.products.map((product) => product.id)
    if (!ids.length) return new Map<string, number>()
    const rows = await client.query<{ product_id: string; available_quantity: number }>(
      `SELECT product_id, available_quantity FROM product_inventory WHERE product_id = ANY($1::text[])`,
      [ids]
    )
    return new Map(rows.rows.map((row) => [row.product_id, row.available_quantity]))
  })
}

export function applyInventoryAvailability(catalog: CatalogConfig, availability: Map<string, number>): CatalogConfig {
  return {
    ...catalog,
    products: catalog.products.map((product) => ({
      ...product,
      stockAvailable: product.sellIndividually === true ? (availability.get(product.id) ?? 0) : undefined
    }))
  }
}

export async function reserveInventoryForOrderWithClient(
  client: PoolClient,
  orderId: string,
  lineItems: OrderLineItem[]
) {
  if (!lineItems.length) return
  await releaseExpiredWithClient(client)
  for (const item of lineItems) {
    const existing = await client.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE order_id = $1 AND product_id = $2 FOR UPDATE`,
      [orderId, item.productId]
    )
    if (existing.rows[0]?.status === "reserved" || existing.rows[0]?.status === "committed") continue

    await client.query(
      `INSERT INTO product_inventory (product_id, available_quantity)
       VALUES ($1, 1)
       ON CONFLICT (product_id) DO NOTHING`,
      [item.productId]
    )
    const inventory = await client.query<{ available_quantity: number }>(
      `SELECT available_quantity FROM product_inventory WHERE product_id = $1 FOR UPDATE`,
      [item.productId]
    )
    if (!inventory.rows[0] || inventory.rows[0].available_quantity < item.quantity) {
      const error = new Error("OUT_OF_STOCK") as Error & { productId?: string }
      error.productId = item.productId
      throw error
    }
    await client.query(
      `UPDATE product_inventory
          SET available_quantity = available_quantity - $1, updated_at = now()
        WHERE product_id = $2`,
      [item.quantity, item.productId]
    )
    await client.query(
      `INSERT INTO inventory_reservations (id, order_id, product_id, quantity, status, expires_at)
       VALUES ($1,$2,$3,$4,'reserved',now() + ($5::int * interval '1 minute'))
       ON CONFLICT (order_id, product_id) DO UPDATE
         SET quantity = EXCLUDED.quantity,
             status = 'reserved',
             expires_at = EXCLUDED.expires_at,
             updated_at = now()`,
      [randomUUID(), orderId, item.productId, item.quantity, RESERVATION_MINUTES]
    )
  }
}

export async function ensureInventoryForPublicOrder(publicId: string, customerAccountId: string) {
  return transaction(async (client) => {
    const order = await client.query<{ id: string; line_items: OrderLineItem[]; order_type: string }>(
      `SELECT id, line_items, order_type FROM orders
        WHERE public_id = $1 AND customer_account_id = $2
        FOR UPDATE`,
      [publicId, customerAccountId]
    )
    const row = order.rows[0]
    if (!row) throw new Error("PAYMENT_ORDER_NOT_FOUND")
    if (row.order_type === "individual") await reserveInventoryForOrderWithClient(client, row.id, row.line_items || [])
  })
}

export async function commitInventoryForOrderWithClient(client: PoolClient, orderId: string) {
  await client.query(
    `UPDATE inventory_reservations
        SET status = 'committed', updated_at = now()
      WHERE order_id = $1 AND status = 'reserved'`,
    [orderId]
  )
}

export async function releaseInventoryForOrderWithClient(client: PoolClient, orderId: string) {
  const released = await client.query<{ product_id: string; quantity: number }>(
    `UPDATE inventory_reservations
        SET status = 'released', updated_at = now()
      WHERE order_id = $1 AND status IN ('reserved','committed')
      RETURNING product_id, quantity`,
    [orderId]
  )
  for (const row of released.rows) {
    await client.query(
      `UPDATE product_inventory
          SET available_quantity = available_quantity + $1, updated_at = now()
        WHERE product_id = $2`,
      [row.quantity, row.product_id]
    )
  }
}
