import { orderEvents } from "../../../config/order-events"
import { requirePositiveIntegerEnv } from "../../../config/env"
import { statusHasCapability, workflowActionTarget, type OrderStatus } from "../../domain/order-status"
import { trackingTokenHash } from "../../security/tokens"
import { transaction } from "../db"
import { appendOrderEvent } from "./events"

export function reportOrderIssue(token: string, issueType: string, note: string) {
  return transaction(async (client) => {
    const issueWindowHours = requirePositiveIntegerEnv("issueReportWindowHours")
    const result = await client.query<{ id: string; status: OrderStatus; delivered_at: Date | null; issue_window_open: boolean }>(
      `SELECT id,
              status,
              delivered_at,
              (delivered_at IS NOT NULL AND delivered_at + ($2::int * interval '1 hour') >= now()) AS issue_window_open
       FROM orders
       WHERE tracking_token_hash = $1 AND tracking_expires_at > now()
       FOR UPDATE`,
      [trackingTokenHash(token), issueWindowHours]
    )
    const order = result.rows[0]
    if (!order) return { ok: false as const, code: "ORDER_NOT_FOUND" }
    if (!statusHasCapability(order.status, "issueReport")) return { ok: false as const, code: "ISSUE_NOT_ALLOWED_FOR_STATUS" }
    if (!order.issue_window_open) return { ok: false as const, code: "ISSUE_WINDOW_EXPIRED" }

    const nextStatus = workflowActionTarget("issueReported")
    await client.query(
      `UPDATE orders SET status = $1, issue_type = $2, issue_note = $3, issue_reported_at = now(), updated_at = now() WHERE id = $4`,
      [nextStatus, issueType, note, order.id]
    )
    await appendOrderEvent(client, order.id, orderEvents.issueReported, { from: order.status, to: nextStatus, issueType })
    return { ok: true as const }
  })
}
