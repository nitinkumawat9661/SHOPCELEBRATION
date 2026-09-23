import { randomUUID } from "node:crypto"
import { databaseConfig } from "../../../config/database"
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
  return result.rows[0] ? mapTrackingOrder(result.rows[0]) : null
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
  return result.rows.map(mapOrder)
}

export async function getTierPopularity(): Promise<TierPopularity | null> {
  const result = await query<{ tier_name: string; order_count: number; total_orders: number }>(
    `WITH tier_counts AS (
       SELECT tier_name, count(*)::int AS order_count
       FROM orders
       WHERE status <> 'cancelled'
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
  if (!row || row.total_orders < 20 || row.order_count < 5) return null
  const sharePercent = Math.round((row.order_count / row.total_orders) * 100)
  if (sharePercent < 20) return null
  return { tierName: row.tier_name, orderCount: row.order_count, totalOrders: row.total_orders, sharePercent }
}

export async function canPreparePackingVideo(publicId: string) {
  const result = await query<{ status: OrderStatus }>(`SELECT status FROM orders WHERE public_id = $1`, [publicId])
  const row = result.rows[0]
  return Boolean(row && statusHasCapability(row.status, "packingVideoUpload"))
}

export async function findAdminPackingVideoKey(publicId: string) {
  if (!isSafePublicOrderId(publicId)) return null
  const result = await query<{ packing_video_key: string | null }>(
    `SELECT packing_video_key FROM orders WHERE public_id = $1`,
    [publicId]
  )
  return result.rows[0]?.packing_video_key || null
}
