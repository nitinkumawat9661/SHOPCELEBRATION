import type { PoolClient } from "pg"
import { orderEvents } from "../../../config/order-events"
import { statusHasCapability, workflowActionTarget, type OrderStatus } from "../../domain/order-status"
import { trackingTokenHash } from "../../security/tokens"
import { transaction } from "../db"
import { bookShipwayShipment, ShipwayApiError } from "../shipway"
import { mapOrder, ORDER_SELECT, type DbOrder } from "./types"
import { appendOrderEvent } from "./events"

type ShippingMetadata = {
  carrierId?: string | null
  labelUrl?: string | null
  bookedAt?: Date | null
  markShipped?: boolean
}

async function setShippingDetailsWithClient(
  client: PoolClient,
  publicId: string,
  provider: string,
  trackingNumber: string,
  metadata: ShippingMetadata = {}
) {
  const current = await client.query<{ id: string; status: OrderStatus; order_type: "hamper" | "individual" }>(`SELECT id, status, order_type FROM orders WHERE public_id = $1 FOR UPDATE`, [publicId])
  const order = current.rows[0]
  if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
  if (!statusHasCapability(order.status, "shippingUpdate")) return { ok: false as const, code: "SHIPPING_UPDATE_NOT_ALLOWED" }
  if (order.order_type === "hamper" && order.status !== "customer_approved" && !["shipped", "out_for_delivery"].includes(order.status)) {
    return { ok: false as const, code: "PACKING_APPROVAL_REQUIRED" }
  }

  const shippedStatus = workflowActionTarget("shipped")
  const shouldMarkShipped = metadata.markShipped === true
  const nextStatus = shouldMarkShipped && ((order.order_type === "individual" && order.status === "preparing") || order.status === "customer_approved") ? shippedStatus : order.status

  await client.query(
    `UPDATE orders
        SET shipping_provider = $1,
            shipping_tracking_number = $2,
            shipping_carrier_id = $3,
            shipping_label_url = $4,
            shipping_booked_at = $5,
            status = $6,
            updated_at = now()
      WHERE id = $7`,
    [provider, trackingNumber, metadata.carrierId ?? null, metadata.labelUrl ?? null, metadata.bookedAt ?? null, nextStatus, order.id]
  )
  await appendOrderEvent(client, order.id, orderEvents.shippingUpdated, { provider, trackingNumber })
  if (nextStatus !== order.status) {
    await appendOrderEvent(client, order.id, orderEvents.statusChanged, { from: order.status, to: nextStatus, source: "shipping_details" })
  }
  return { ok: true as const, status: nextStatus }
}

export function setShippingDetails(publicId: string, provider: string, trackingNumber: string, metadata: ShippingMetadata = {}) {
  return transaction((client) => setShippingDetailsWithClient(client, publicId, provider, trackingNumber, metadata))
}

export function bookOrderWithShipway(publicId: string, packed: { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number }) {
  return transaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`shipway-book:${publicId}`])
    const current = await client.query<DbOrder>(`SELECT ${ORDER_SELECT} FROM orders WHERE public_id = $1 FOR UPDATE`, [publicId])
    const row = current.rows[0]
    if (!row) return { ok: false as const, code: "ORDER_NOT_FOUND" }

    const order = mapOrder(row)
    if (!statusHasCapability(order.status, "shippingUpdate")) return { ok: false as const, code: "SHIPPING_UPDATE_NOT_ALLOWED" }
    if (order.orderType === "hamper" && order.status !== "customer_approved" && !["shipped", "out_for_delivery"].includes(order.status)) {
      return { ok: false as const, code: "PACKING_APPROVAL_REQUIRED" }
    }
    if (order.shippingProvider === "Shipway" && order.shippingTrackingNumber) {
      return { ok: true as const, status: order.status, awb: order.shippingTrackingNumber, carrierId: order.shippingCarrierId, labelUrl: order.shippingLabelUrl }
    }

    try {
      const shipment = await bookShipwayShipment(order, packed)
      const saved = await setShippingDetailsWithClient(client, publicId, "Shipway", shipment.awb, {
        carrierId: shipment.carrierId || null,
        labelUrl: shipment.labelUrl,
        bookedAt: new Date(),
        markShipped: false
      })
      if (!saved.ok) return saved
      return { ok: true as const, status: saved.status, awb: shipment.awb, carrierId: shipment.carrierId || null, labelUrl: shipment.labelUrl }
    } catch (error) {
      if (error instanceof ShipwayApiError) return { ok: false as const, code: error.code }
      throw error
    }
  })
}

export function setPackingVideo(publicId: string, key: string) {
  return transaction(async (client) => {
    const current = await client.query<{ id: string; status: OrderStatus; order_type: "hamper" | "individual" }>(`SELECT id, status, order_type FROM orders WHERE public_id = $1 FOR UPDATE`, [publicId])
    const order = current.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    if (order.order_type !== "hamper") return { ok: false as const, code: "PACKING_VIDEO_HAMPER_ONLY" }
    if (!statusHasCapability(order.status, "packingVideoUpload")) return { ok: false as const, code: "PACKING_VIDEO_UPLOAD_NOT_ALLOWED" }

    const nextStatus = workflowActionTarget("packingVideoReady")
    await client.query(`UPDATE orders SET packing_video_key = $1, status = $2, updated_at = now() WHERE id = $3`, [key, nextStatus, order.id])
    await appendOrderEvent(client, order.id, orderEvents.packingVideoUploaded, { from: order.status, to: nextStatus })
    return { ok: true as const }
  })
}

async function approveOrderRow(client: PoolClient, order: { id: string; public_id: string; status: OrderStatus; packing_video_key: string | null; order_type: "hamper" | "individual" }) {
  if (order.order_type !== "hamper") return { ok: false as const, code: "PACKING_VIDEO_HAMPER_ONLY" }
  if (!order.packing_video_key) return { ok: false as const, code: "PACKING_VIDEO_NOT_READY" }
  if (!statusHasCapability(order.status, "packingVideoApproval")) return { ok: false as const, code: "INVALID_STATUS_TRANSITION" }

  const nextStatus = workflowActionTarget("customerApproved")
  await client.query(`UPDATE orders SET status = $1, customer_approved_at = now(), updated_at = now() WHERE id = $2`, [nextStatus, order.id])
  await appendOrderEvent(client, order.id, orderEvents.customerApprovedPacking, { from: order.status, to: nextStatus })
  return { ok: true as const, publicId: order.public_id, status: nextStatus }
}

export function approvePackingVideo(token: string) {
  return transaction(async (client) => {
    const result = await client.query<{ id: string; public_id: string; status: OrderStatus; packing_video_key: string | null; order_type: "hamper" | "individual" }>(
      `SELECT id, public_id, status, packing_video_key, order_type FROM orders WHERE tracking_token_hash = $1 AND tracking_expires_at > now() FOR UPDATE`,
      [trackingTokenHash(token)]
    )
    const order = result.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    return approveOrderRow(client, order)
  })
}

export function approvePackingVideoForAccount(publicId: string, customerAccountId: string) {
  return transaction(async (client) => {
    const result = await client.query<{ id: string; public_id: string; status: OrderStatus; packing_video_key: string | null; order_type: "hamper" | "individual" }>(
      `SELECT id, public_id, status, packing_video_key, order_type
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
