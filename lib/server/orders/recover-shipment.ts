import { orderEvents } from "../../../config/order-events"
import type { OrderStatus } from "../../domain/order-status"
import { transaction } from "../db"
import { appendOrderEvent } from "./events"

/**
 * Restores an AWB only when Shipway returned EXACT merchant order ownership.
 * This operation never books a new courier, alters payment or advances status.
 */
export async function attachVerifiedShipwayAwb(publicId: string, awb: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(publicId) ||
      !/^[A-Za-z0-9._-]{4,120}$/.test(awb)) return false

  return transaction(async client => {
    // Avoid accidentally assigning the same courier parcel to different
    // Celebration purchases when account screens are refreshed concurrently.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`shipway-awb:${awb}`]
    )
    const found = await client.query<{
      id: string
      status: OrderStatus
      order_type: "individual" | "hamper"
      payment_status: string
      shipping_provider: string | null
      shipping_tracking_number: string | null
    }>(
      `SELECT id,status,order_type,payment_status,shipping_provider,shipping_tracking_number
         FROM orders WHERE public_id=$1 FOR UPDATE`,
      [publicId]
    )
    const order = found.rows[0]
    if (!order) return false
    if (order.shipping_tracking_number) {
      return order.shipping_tracking_number === awb &&
        order.shipping_provider?.trim().toLowerCase() === "shipway"
    }
    if (order.shipping_provider && order.shipping_provider.trim().toLowerCase() !== "shipway") return false
    if (!["paid","verified","success"].includes(order.payment_status.trim().toLowerCase())) return false
    if (!["preparing","customer_approved","shipped","out_for_delivery"].includes(order.status)) return false
    if (order.order_type === "hamper" && order.status === "preparing") return false

    const collision = await client.query<{ id: string }>(
      "SELECT id FROM orders WHERE shipping_tracking_number=$1 AND id<>$2 LIMIT 1",
      [awb, order.id]
    )
    if (collision.rows.length) return false

    const updated = await client.query<{ id: string }>(
      `UPDATE orders
          SET shipping_provider='Shipway',
              shipping_tracking_number=$1,
              updated_at=now()
        WHERE id=$2 AND shipping_tracking_number IS NULL
        RETURNING id`,
      [awb, order.id]
    )
    if (!updated.rows.length) return false
    await appendOrderEvent(client, order.id, orderEvents.shippingUpdated, {
      provider: "Shipway",
      trackingNumber: awb,
      source: "verified_shipway_order_id_recovery"
    })
    return true
  })
}
