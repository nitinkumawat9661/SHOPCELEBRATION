import { orderEvents } from "../../../config/order-events"
import { canAdminTransition, paymentStatusForOrderStatus, workflowActionTarget, type OrderStatus } from "../../domain/order-status"
import { transaction } from "../db"
import { appendOrderEvent } from "./events"

export function updateOrderStatus(publicId: string, nextStatus: OrderStatus) {
  return transaction(async (client) => {
    const current = await client.query<{ id: string; status: OrderStatus; payment_status: string; shipping_tracking_number: string | null }>(
      `SELECT id, status, payment_status, shipping_tracking_number FROM orders WHERE public_id = $1 FOR UPDATE`,
      [publicId]
    )
    const row = current.rows[0]
    if (!row) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    if (!canAdminTransition(row.status, nextStatus)) return { ok: false as const, code: "INVALID_STATUS_TRANSITION" }
    if (nextStatus === workflowActionTarget("shipped") && !row.shipping_tracking_number) {
      return { ok: false as const, code: "SHIPPING_DETAILS_REQUIRED" }
    }

    const paymentStatus = paymentStatusForOrderStatus(nextStatus, row.payment_status)
    const deliveredStatus = "delivered" satisfies OrderStatus
    await client.query(
      `UPDATE orders
       SET status = $1,
           payment_status = $2,
           delivered_at = CASE WHEN $1 = $3 THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
           updated_at = now()
       WHERE id = $4`,
      [nextStatus, paymentStatus, deliveredStatus, row.id]
    )
    await appendOrderEvent(client, row.id, orderEvents.statusChanged, { from: row.status, to: nextStatus })
    return { ok: true as const }
  })
}
