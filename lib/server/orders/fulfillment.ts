import type { PoolClient } from "pg"
import { orderEvents } from "../../../config/order-events"
import { statusHasCapability, workflowActionTarget, type OrderStatus } from "../../domain/order-status"
import { trackingTokenHash } from "../../security/tokens"
import { transaction } from "../db"
import { appendOrderEvent } from "./events"

export function setShippingDetails(publicId: string, provider: string, trackingNumber: string) {
  return transaction(async (client) => {
    const current = await client.query<{ id: string; status: OrderStatus }>(`SELECT id, status FROM orders WHERE public_id = $1 FOR UPDATE`, [publicId])
    const order = current.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    if (!statusHasCapability(order.status, "shippingUpdate")) return { ok: false as const, code: "SHIPPING_UPDATE_NOT_ALLOWED" }

    await client.query(
      `UPDATE orders SET shipping_provider = $1, shipping_tracking_number = $2, updated_at = now() WHERE id = $3`,
      [provider, trackingNumber, order.id]
    )
    await appendOrderEvent(client, order.id, orderEvents.shippingUpdated, { provider, trackingNumber })
    return { ok: true as const }
  })
}

export function setPackingVideo(publicId: string, key: string) {
  return transaction(async (client) => {
    const current = await client.query<{ id: string; status: OrderStatus }>(`SELECT id, status FROM orders WHERE public_id = $1 FOR UPDATE`, [publicId])
    const order = current.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    if (!statusHasCapability(order.status, "packingVideoUpload")) return { ok: false as const, code: "PACKING_VIDEO_UPLOAD_NOT_ALLOWED" }

    const nextStatus = workflowActionTarget("packingVideoReady")
    await client.query(`UPDATE orders SET packing_video_key = $1, status = $2, updated_at = now() WHERE id = $3`, [key, nextStatus, order.id])
    await appendOrderEvent(client, order.id, orderEvents.packingVideoUploaded, { from: order.status, to: nextStatus })
    return { ok: true as const }
  })
}

async function approveOrderRow(client: PoolClient, order: { id: string; status: OrderStatus; packing_video_key: string | null }) {
  if (!order.packing_video_key) return { ok: false as const, code: "PACKING_VIDEO_NOT_READY" }
  if (!statusHasCapability(order.status, "packingVideoApproval")) return { ok: false as const, code: "INVALID_STATUS_TRANSITION" }

  const nextStatus = workflowActionTarget("customerApproved")
  await client.query(`UPDATE orders SET status = $1, customer_approved_at = now(), updated_at = now() WHERE id = $2`, [nextStatus, order.id])
  await appendOrderEvent(client, order.id, orderEvents.customerApprovedPacking, { from: order.status, to: nextStatus })
  return { ok: true as const }
}

export function approvePackingVideo(token: string) {
  return transaction(async (client) => {
    const result = await client.query<{ id: string; status: OrderStatus; packing_video_key: string | null }>(
      `SELECT id, status, packing_video_key FROM orders WHERE tracking_token_hash = $1 AND tracking_expires_at > now() FOR UPDATE`,
      [trackingTokenHash(token)]
    )
    const order = result.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    return approveOrderRow(client, order)
  })
}

export function approvePackingVideoForAccount(publicId: string, customerAccountId: string) {
  return transaction(async (client) => {
    const result = await client.query<{ id: string; status: OrderStatus; packing_video_key: string | null }>(
      `SELECT id, status, packing_video_key
         FROM orders
        WHERE public_id = $1 AND customer_account_id = $2
        FOR UPDATE`,
      [publicId, customerAccountId]
    )
    const order = result.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    return approveOrderRow(client, order)
  })
}
