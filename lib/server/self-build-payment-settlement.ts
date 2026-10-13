// Staged, trusted-provider-only Self-Build category reservation settlement.
// Not called by public checkout or the live webhook yet. Existing jewelry and
// curated hamper gateway / inventory logic must remain untouched.
//
// Transaction contract: caller already verified provider authenticity AND
// persisted its payment event/order update in THIS SAME transaction. Acquire
// self_build_capacity_control FOR UPDATE before locking payment attempts or
// orders, in that order throughout payment/cancellation paths, to avoid
// capacity<->order deadlocks. Do not call after acquiring order row locks.
import type { PoolClient } from "pg"
import type { ProviderPaymentResult } from "./payments/provider"
import { commitSelfBuildReservationWithClient, releaseSelfBuildReservationWithClient } from "./self-build-reservations"
import { isPaymentConfirmed } from "../domain/payment"

type Resolution =
  | { status: "not_self_build"; changed: false }
  | { status: "committed" | "released"; changed: boolean }
  | { status: "needs_manual_review" | "awaiting_provider"; changed: false; code: string }

// The payment_events row acts as our durable *verified* event assertion;
// the signed gateway webhook must be validated before creating that row.
export async function settleStagedSelfBuildPaymentWithClient(
  client: PoolClient,
  input: { orderId: string; result: ProviderPaymentResult }
): Promise<Resolution> {
  if (!input || typeof input.orderId !== "string" || !input.orderId ||
      !input.result || !["razorpay","cashfree"].includes(input.result.provider) ||
      !["paid","failed","pending"].includes(input.result.status) ||
      !input.result.eventId || !input.result.providerOrderId)
    throw new Error("SELF_BUILD_PAYMENT_EVENT_INVALID")

  // READ-ONLY early detection: never touch unrelated checkout stock/state.
  const ledger = await client.query<{ order_id: string }>(
    "SELECT order_id FROM self_build_order_reservation_batches WHERE order_id=$1", [input.orderId])
  if (!ledger.rows[0]) return { status: "not_self_build", changed: false }

  // Acquire capacity lock FIRST; any future checkout/provider integration
  // must use this same lock order before FOR UPDATE on the payment order row.
  const capacity = await client.query<{ version: number }>(
    "SELECT version FROM self_build_capacity_control WHERE id='primary' FOR UPDATE")
  if (!capacity.rows[0]) throw new Error("SELF_BUILD_CAPACITY_CONTROL_MISSING")
  const orderResult = await client.query<{
    id: string; order_type: string; amount_paise: number; payment_status: string;
    status: string; payment_provider: string | null; provider_order_id: string | null
  }>(`
    SELECT id,order_type,amount_paise,payment_status,status,payment_provider,provider_order_id
    FROM orders WHERE id=$1 FOR UPDATE`, [input.orderId])
  const order = orderResult.rows[0]
  if (!order || order.order_type !== "hamper")
    throw new Error("SELF_BUILD_RESERVATION_ORDER_MISMATCH")

  const batch = await client.query<{ status: string; expires_at: Date }>(
    "SELECT status,expires_at FROM self_build_order_reservation_batches WHERE order_id=$1 FOR UPDATE",
    [input.orderId])
  if (!batch.rows[0]) throw new Error("SELF_BUILD_RESERVATION_NOT_FOUND")
  const active = batch.rows[0]

  // A known event must have been persisted inside the trusted signed-provider
  // transaction. Never accept a forged/unknown callback object.
  const event = await client.query<{ id: string }>(`
    SELECT id FROM payment_events
    WHERE order_id=$1 AND provider=$2 AND provider_event_id=$3 LIMIT 1`,
    [input.orderId,input.result.provider,input.result.eventId])
  if (!event.rows[0]) throw new Error("SELF_BUILD_PAYMENT_EVENT_NOT_RECORDED")

  const attempt = await client.query<{ status: string }>(`
    SELECT status FROM payment_attempts
    WHERE order_id=$1 AND provider=$2 AND provider_order_id=$3
    ORDER BY attempt_no DESC LIMIT 1`,
    [input.orderId,input.result.provider,input.result.providerOrderId])
  // Late successes on older attempts could represent collected money: never
  // silently discard or release a reserved/paid order.
  if (!attempt.rows[0] || order.provider_order_id !== input.result.providerOrderId ||
      order.payment_provider !== input.result.provider)
    return { status: "needs_manual_review", changed: false, code: "STALE_OR_UNKNOWN_PAYMENT_ATTEMPT" }

  if (active.status === "committed")
    return { status: "committed", changed: false }
  if (active.status === "released") {
    if (input.result.status === "failed")
      return { status: "released", changed: false }
    return { status: "needs_manual_review", changed: false, code: "RESERVATION_ALREADY_RELEASED" }
  }

  const paid = isPaymentConfirmed(order.payment_status, order.status)
  if (input.result.status === "paid") {
    if (input.result.amountPaise == null || input.result.amountPaise !== order.amount_paise)
      throw new Error("SELF_BUILD_PAYMENT_AMOUNT_MISMATCH")
    if (!paid || attempt.rows[0].status !== "paid")
      return { status: "needs_manual_review", changed: false, code: "PAYMENT_NOT_VERIFIED" }
    if (order.status === "cancelled")
      return { status: "needs_manual_review", changed: false, code: "PAID_AFTER_CANCELLATION" }
    if (active.expires_at <= new Date())
      return { status: "needs_manual_review", changed: false, code: "PAID_AFTER_RESERVATION_EXPIRY" }
    // Payment status was persisted in this transaction by trusted provider
    // path. Category units consumed atomically or nothing commits.
    const committed = await commitSelfBuildReservationWithClient(client,input.orderId)
    return { status: "committed", changed: committed.changed }
  }

  if (paid) {
    // A late negative event cannot undo verified payment or consumed stock.
    return { status: "needs_manual_review", changed: false, code: "PAYMENT_ALREADY_CONFIRMED" }
  }
  if (input.result.status !== "failed" || order.payment_status !== "failed" ||
      attempt.rows[0].status !== "failed") {
    return { status: "awaiting_provider", changed: false, code: "PAYMENT_NOT_FINALLY_FAILED" }
  }

  // Failure must apply to the CURRENT provider attempt, not a failed older
  // checkout retry. Releasing a current attempt requires verified provider
  // failure and an order that has not received any confirmed payment.
  const released = await releaseSelfBuildReservationWithClient(client,input.orderId)
  return { status: "released", changed: released.changed }
}
