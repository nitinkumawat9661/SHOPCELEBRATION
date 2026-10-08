import { orderEvents } from "../../../config/order-events"
import type { OrderStatus } from "../../domain/order-status"
import { isPaymentConfirmed } from "../../domain/payment"
import { isSafePublicOrderId } from "../../validation/identifiers"
import { cancelShipwayShipment, getShipwayTracking, ShipwayApiError } from "../shipway"
import { transaction } from "../db"
import { releaseInventoryForOrderWithClient } from "../inventory"
import { appendOrderEvent } from "./events"

const CUSTOMER_CANCELLABLE = new Set<OrderStatus>([
  "payment_verification_pending",
  "payment_verified",
  "preparing",
  "packing_video_ready",
  "customer_approved"
])

const SHIPWAY_ALREADY_DISPATCHED = new Set([
  "PKP",
  "INT",
  "OOD",
  "OFD",
  "DEL",
  "RTO",
  "RTD",
  "UND",
  "DEX",
  "DRE",
  "CRTA",
  "CNA",
  "ODA",
  "SMD"
])

export function customerCanCancelStatus(status: OrderStatus) {
  return CUSTOMER_CANCELLABLE.has(status)
}

export function cancelCustomerOrder(publicIdValue: string, customerAccountId: string) {
  const publicId = String(publicIdValue || "").trim()
  if (!isSafePublicOrderId(publicId)) return Promise.resolve({ ok: false as const, code: "ORDER_NOT_FOUND" })

  return transaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`shipway-book:${publicId}`])
    const current = await client.query<{
      id: string
      status: OrderStatus
      payment_status: string
      shipping_provider: string | null
      shipping_tracking_number: string | null
    }>(
      `SELECT id, status, payment_status, shipping_provider, shipping_tracking_number
         FROM orders
        WHERE public_id = $1 AND customer_account_id = $2
        FOR UPDATE`,
      [publicId, customerAccountId]
    )
    const order = current.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    if (order.status === "cancelled") {
      return {
        ok: true as const,
        status: "cancelled" as const,
        shipwayCancelled: order.shipping_provider === "Shipway" && Boolean(order.shipping_tracking_number),
        refundRequired: isPaymentConfirmed(order.payment_status, order.status)
      }
    }
    if (!customerCanCancelStatus(order.status)) return { ok: false as const, code: "ORDER_CANCELLATION_NOT_ALLOWED" }

    let shipwayCancelled = false
    if (order.shipping_provider === "Shipway" && order.shipping_tracking_number) {
      try {
        const live = await getShipwayTracking(order.shipping_tracking_number)
        const remoteStatus = live?.shipmentStatus?.toUpperCase() || ""
        if (SHIPWAY_ALREADY_DISPATCHED.has(remoteStatus)) {
          return { ok: false as const, code: "ORDER_ALREADY_SHIPPED" }
        }
        await cancelShipwayShipment(order.shipping_tracking_number)
        shipwayCancelled = true
      } catch (error) {
        if (error instanceof ShipwayApiError) {
          return { ok: false as const, code: error.code === "SHIPWAY_CANCEL_FAILED" ? "SHIPWAY_CANCEL_FAILED" : "SHIPWAY_CANCELLATION_UNAVAILABLE" }
        }
        throw error
      }
    }

    await client.query(
      `UPDATE orders
          SET status = 'cancelled',
              shipping_label_url = CASE WHEN shipping_provider = 'Shipway' THEN NULL ELSE shipping_label_url END,
              tracking_token_hash = 'revoked:' || id,
              tracking_expires_at = now(),
              updated_at = now()
        WHERE id = $1`,
      [order.id]
    )
    await releaseInventoryForOrderWithClient(client, order.id)
    await appendOrderEvent(client, order.id, orderEvents.statusChanged, {
      from: order.status,
      to: "cancelled",
      source: "customer",
      shipwayCancelled
    })
    return {
      ok: true as const,
      status: "cancelled" as const,
      shipwayCancelled,
      refundRequired: isPaymentConfirmed(order.payment_status, order.status)
    }
  })
}
