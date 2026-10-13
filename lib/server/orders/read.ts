import { randomUUID } from "node:crypto"
import { databaseConfig } from "../../../config/database"
import { requirePositiveIntegerEnv } from "../../../config/env"
import { validation } from "../../../config/validation"
import { statusHasCapability, type OrderStatus } from "../../domain/order-status"
import { createTrackingToken, trackingTokenHash } from "../../security/tokens"
import { isSafePublicOrderId } from "../../validation/identifiers"
import { query } from "../db"
import { mapOrder, mapTrackingOrder, ORDER_SELECT, TRACKING_ORDER_SELECT, type DbOrder, type DbTrackingOrder } from "./types"

export type TierPopularity = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

export async function findOrderByTrackingToken(token: string) {
  const result = await query<DbTrackingOrder>(
    `SELECT ${TRACKING_ORDER_SELECT} FROM orders WHERE tracking_token_hash = $1 AND tracking_expires_at > now()`,
    [trackingTokenHash(token)]
  )
  if (!result.rows[0]) return null
  const mapped = mapTrackingOrder(result.rows[0])
  const deliveredAt = result.rows[0].delivered_at
  const issueWindowHours = requirePositiveIntegerEnv("issueReportWindowHours")
  return {
    ...mapped,
    issueReportDeadline: deliveredAt
      ? new Date(deliveredAt.getTime() + issueWindowHours * 60 * 60 * 1000).toISOString()
      : null
  }
}

export async function issueTrackingTokenForLookup(publicId: string, phoneSuffix: string) {
  if (!isSafePublicOrderId(publicId)) return null
  if (!/^\d+$/.test(phoneSuffix) || phoneSuffix.length !== validation.trackingLookupPhoneDigits) return null

  const token = createTrackingToken(`lookup:${publicId}:${randomUUID()}`)
  const expiresAt = new Date(Date.now() + validation.trackingTokenTtlSeconds * 1000)
  const result = await query<{ public_id: string }>(
    `UPDATE orders
       SET tracking_token_hash = $1, tracking_expires_at = $2, updated_at = now()
     WHERE public_id = $3
       AND right(phone, $4::int) = $5
       AND status <> 'cancelled'
     RETURNING public_id`,
    [trackingTokenHash(token), expiresAt, publicId, validation.trackingLookupPhoneDigits, phoneSuffix]
  )
  return result.rows[0] ? token : null
}

export async function listOrders(limit = databaseConfig.adminOrderListDefault) {
  const safeLimit = Math.min(Math.max(limit, 1), databaseConfig.adminOrderListMax)
  const result = await query<DbOrder>(
    `SELECT ${ORDER_SELECT} FROM orders ORDER BY created_at DESC LIMIT $1`,
    [safeLimit]
  )
  const orders = result.rows.map(mapOrder)
  if (!orders.length) return orders

  // Authenticated admin list only: order snapshots are NEVER joined into
  // customer tracking or public My Orders endpoints. No internal budget data
  // or photo object keys leave the backend.
  const snapshots = await query<{
    public_id: string
    selections: unknown
    other_request_text: string
    reservation_status: "reserved" | "committed" | "released" | null
  }>(
    `SELECT o.public_id,s.selections,s.other_request_text,
            b.status AS reservation_status
       FROM orders o
       JOIN self_build_order_snapshots s ON s.order_id=o.id
       LEFT JOIN self_build_order_reservation_batches b ON b.order_id=o.id
      WHERE o.public_id = ANY($1::text[])`,
    [orders.map(order => order.publicId)]
  )
  const byId = new Map(snapshots.rows.map(s => [s.public_id, s]))
  return orders.map(order => {
    const snapshot = byId.get(order.publicId)
    if (!snapshot) return order
    const selections = Array.isArray(snapshot.selections)
      ? snapshot.selections.filter((entry): entry is Record<string, unknown> =>
          entry !== null && typeof entry === "object" && !Array.isArray(entry))
          .filter(entry => (entry.kind === "category" || entry.kind === "option") &&
            typeof entry.label === "string" &&
            typeof entry.id === "string" &&
            typeof entry.quantity === "number" &&
            Number.isSafeInteger(entry.quantity) && entry.quantity > 0)
          .slice(0, 200).map(entry => ({
            kind: entry.kind as "category" | "option",
            id: String(entry.id), label: String(entry.label).slice(0,100),
            quantity: Number(entry.quantity)
          })) : []
    return {
      ...order,
      selfBuild: {
        selections,
        otherRequestText: snapshot.other_request_text,
        reservationStatus: snapshot.reservation_status
      }
    }
  })
}

export async function getTierPopularity(): Promise<TierPopularity | null> {
  const result = await query<{ tier_name: string; order_count: number; total_orders: number }>(
    `WITH tier_counts AS (
       SELECT tier_name, count(DISTINCT id)::int AS order_count
       FROM orders
       WHERE status = 'delivered' AND order_type = 'hamper'
         AND payment_status IN ('paid', 'verified', 'success')
         AND tier_name IS NOT NULL AND btrim(tier_name) <> ''
       GROUP BY tier_name
     ), totals AS (
       SELECT coalesce(sum(order_count), 0)::int AS total_orders FROM tier_counts
     )
     SELECT tier_counts.tier_name, tier_counts.order_count, totals.total_orders
     FROM tier_counts CROSS JOIN totals
     ORDER BY tier_counts.order_count DESC, tier_counts.tier_name ASC
     LIMIT 1`
  )
  const row = result.rows[0]
  if (!row || !row.tier_name?.trim() ||
      !Number.isSafeInteger(row.total_orders) || !Number.isSafeInteger(row.order_count) ||
      row.total_orders < 20 || row.order_count < 5 || row.order_count > row.total_orders) return null
  const sharePercent = Math.round((row.order_count / row.total_orders) * 100)
  if (sharePercent < 20 || sharePercent > 100) return null
  return { tierName: row.tier_name, orderCount: row.order_count, totalOrders: row.total_orders, sharePercent }
}

export async function canPreparePackingVideo(publicId: string) {
  const result = await query<{ status: OrderStatus; order_type: "hamper" | "individual" }>(`SELECT status, order_type FROM orders WHERE public_id = $1`, [publicId])
  const row = result.rows[0]
  return Boolean(row && row.order_type === "hamper" && statusHasCapability(row.status, "packingVideoUpload"))
}

export async function findAdminPackingVideoKey(publicId: string) {
  if (!isSafePublicOrderId(publicId)) return null
  const result = await query<{ packing_video_key: string | null }>(
    `SELECT packing_video_key FROM orders WHERE public_id = $1`,
    [publicId]
  )
  return result.rows[0]?.packing_video_key || null
}
