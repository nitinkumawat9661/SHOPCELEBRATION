import { transaction, query } from "./db"
import { getCatalogConfig } from "./catalog"

export const WISHLIST_LIMIT = 120
export const validWishlistId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)

export class WishlistError extends Error {
  constructor(public readonly code: string, public readonly status = 422) { super(code) }
}

export async function listAccountWishlist(accountId: string): Promise<string[]> {
  const result = await query<{ product_id: string }>(
    "SELECT product_id FROM customer_wishlist WHERE account_id = $1 ORDER BY created_at DESC, product_id DESC LIMIT $2",
    [accountId, WISHLIST_LIMIT]
  )
  return result.rows.map(row => row.product_id)
}

async function verifiedIds(ids: string[]) {
  const catalog = await getCatalogConfig()
  const active = new Set(catalog.catalog.products.filter(product => product.active !== false).map(p => p.id))
  return ids.filter(id => active.has(id))
}

export async function addWishlistProducts(accountId: string, submitted: unknown): Promise<string[]> {
  if (!Array.isArray(submitted) || submitted.length > WISHLIST_LIMIT ||
      submitted.some(value => !validWishlistId(value))) throw new WishlistError("INVALID_WISHLIST")
  const ids = [...new Set(submitted as string[])]
  const allowed = await verifiedIds(ids)
  // Serializes per-account updates, including concurrent mobile/desktop saves.
  await transaction(async client => {
    const lock = await client.query("SELECT id FROM customer_accounts WHERE id = $1 AND status = 'active' AND phone_verified_at IS NOT NULL FOR UPDATE", [accountId])
    if (!lock.rowCount) throw new WishlistError("AUTH_REQUIRED", 401)
    const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM customer_wishlist WHERE account_id = $1", [accountId])
    let slots = Math.max(0, WISHLIST_LIMIT - Number(count.rows[0].count))
    for (const id of allowed) {
      if (!slots) break
      const result = await client.query(
        "INSERT INTO customer_wishlist (account_id,product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [accountId,id]
      )
      if (result.rowCount) slots--
    }
  })
  return listAccountWishlist(accountId)
}

export async function setWishlistProduct(accountId: string, id: unknown, saved: unknown): Promise<string[]> {
  if (!validWishlistId(id) || typeof saved !== "boolean") throw new WishlistError("INVALID_WISHLIST")
  if (saved && !(await verifiedIds([id])).length) throw new WishlistError("PRODUCT_NOT_AVAILABLE", 404)
  await transaction(async client => {
    const lock = await client.query("SELECT id FROM customer_accounts WHERE id = $1 AND status = 'active' AND phone_verified_at IS NOT NULL FOR UPDATE", [accountId])
    if (!lock.rowCount) throw new WishlistError("AUTH_REQUIRED", 401)
    if (!saved) {
      await client.query("DELETE FROM customer_wishlist WHERE account_id = $1 AND product_id = $2", [accountId,id])
      return
    }
    // Idempotent re-save must succeed even when the wishlist is already full.
    const present = await client.query("SELECT 1 FROM customer_wishlist WHERE account_id = $1 AND product_id = $2", [accountId,id])
    if (present.rowCount) return
    const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM customer_wishlist WHERE account_id = $1", [accountId])
    if (Number(count.rows[0].count) >= WISHLIST_LIMIT) throw new WishlistError("WISHLIST_FULL", 409)
    await client.query("INSERT INTO customer_wishlist (account_id, product_id) VALUES ($1,$2)", [accountId,id])
  })
  return listAccountWishlist(accountId)
}
