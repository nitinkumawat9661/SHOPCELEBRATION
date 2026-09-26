import { createHash, randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { securityConfig } from "../../../config/security"
import { createTrackingToken } from "../../security/tokens"
import { transaction } from "../db"
import type { ProviderCheckout, ProviderPaymentResult } from "./provider"

export type PaymentOrderSnapshot = {
  internalId: string
  publicId: string
  customerAccountId: string
  idempotencyKey: string
  amountPaise: number
  subtotalPaise: number
  discountPaise: number
  campaignId: string | null
  campaignTitle: string | null
  tierName: string
  customerName: string
  phone: string
  paymentStatus: string
  status: string
  paymentAttemptCount: number
}

type PaymentAttemptRow = {
  id: string
  order_id: string
  attempt_no: number
  provider: "razorpay" | "cashfree"
  provider_order_id: string
  provider_session_id: string | null
  provider_payment_id: string | null
  status: string
  created_at: Date
}

async function findOrderForUpdate(client: PoolClient, publicId: string, customerAccountId?: string) {
  const params: unknown[] = [publicId]
  let ownerClause = ""
  if (customerAccountId) {
    params.push(customerAccountId)
    ownerClause = ` AND customer_account_id = $${params.length}`
  }
  const result = await client.query<{
    id: string
    public_id: string
    customer_account_id: string
    idempotency_key: string
    amount_paise: number
    subtotal_paise: number
    discount_paise: number
    campaign_id: string | null
    campaign_title: string | null
    tier_name: string
    customer_name: string
    phone: string
    payment_status: string
    status: string
    payment_attempt_count: number
  }>(
    `SELECT id, public_id, customer_account_id, idempotency_key, amount_paise, subtotal_paise, discount_paise,
            campaign_id, campaign_title, tier_name, customer_name, phone, payment_status, status, payment_attempt_count
       FROM orders
      WHERE public_id = $1${ownerClause}
      FOR UPDATE`,
    params
  )
  return result.rows[0] || null
}

function mapSnapshot(row: NonNullable<Awaited<ReturnType<typeof findOrderForUpdate>>>): PaymentOrderSnapshot {
  return {
    internalId: row.id,
    publicId: row.public_id,
    customerAccountId: row.customer_account_id,
    idempotencyKey: row.idempotency_key,
    amountPaise: row.amount_paise,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    tierName: row.tier_name,
    customerName: row.customer_name,
    phone: row.phone,
    paymentStatus: row.payment_status,
    status: row.status,
    paymentAttemptCount: row.payment_attempt_count
  }
}

export async function getPaymentOrder(publicId: string, customerAccountId: string) {
  return transaction(async (client) => {
    const row = await findOrderForUpdate(client, publicId, customerAccountId)
    return row ? mapSnapshot(row) : null
  })
}

export type ReservedPaymentAttempt = {
  order: PaymentOrderSnapshot
  attemptId: string
  attemptNo: number
  providerReference: string
  reusable: null | {
    provider: "razorpay" | "cashfree"
    providerOrderId: string
    providerSessionId: string | null
  }
}

export function reservePaymentAttempt(publicId: string, customerAccountId: string, provider: "razorpay" | "cashfree") {
  return transaction<ReservedPaymentAttempt>(async (client) => {
    const orderRow = await findOrderForUpdate(client, publicId, customerAccountId)
    if (!orderRow) throw new Error("PAYMENT_ORDER_NOT_FOUND")
    const order = mapSnapshot(orderRow)
    if (order.paymentStatus === "paid" || order.status === "payment_verified") {
      return { order, attemptId: "", attemptNo: order.paymentAttemptCount, providerReference: "", reusable: null }
    }

    const latest = await client.query<PaymentAttemptRow>(
      `SELECT id, order_id, attempt_no, provider, provider_order_id, provider_session_id, provider_payment_id, status, created_at
         FROM payment_attempts
        WHERE order_id = $1
        ORDER BY attempt_no DESC
        LIMIT 1`,
      [order.internalId]
    )
    const attempt = latest.rows[0]
    if (attempt && attempt.provider === provider && attempt.status === "pending" && attempt.provider_session_id) {
      return {
        order,
        attemptId: attempt.id,
        attemptNo: attempt.attempt_no,
        providerReference: attempt.provider_order_id,
        reusable: {
          provider,
          providerOrderId: attempt.provider_order_id,
          providerSessionId: attempt.provider_session_id
        }
      }
    }
    if (attempt && attempt.status === "creating" && Date.now() - attempt.created_at.getTime() < 120_000) {
      throw new Error("PAYMENT_ATTEMPT_INITIALIZING")
    }

    const attemptNo = order.paymentAttemptCount + 1
    const attemptId = randomUUID()
    const providerReference = `${order.publicId}-${attemptNo}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40)
    await client.query(
      `INSERT INTO payment_attempts (id, order_id, attempt_no, provider, provider_order_id, status)
       VALUES ($1,$2,$3,$4,$5,'creating')`,
      [attemptId, order.internalId, attemptNo, provider, providerReference]
    )
    await client.query(
      `UPDATE orders
          SET payment_provider = $1,
              provider_order_id = $2,
              provider_session_id = NULL,
              provider_payment_id = NULL,
              payment_status = 'pending',
              payment_error_code = NULL,
              payment_attempt_count = $3,
              updated_at = now()
        WHERE id = $4`,
      [provider, providerReference, attemptNo, order.internalId]
    )
    return { order: { ...order, paymentAttemptCount: attemptNo, paymentStatus: "pending" }, attemptId, attemptNo, providerReference, reusable: null }
  })
}

export function bindPaymentAttempt(attemptId: string, checkout: ProviderCheckout) {
  const session = checkout.provider === "cashfree" ? checkout.paymentSessionId : checkout.providerOrderId
  return transaction(async (client) => {
    const attempt = await client.query<{ order_id: string }>(
      `UPDATE payment_attempts
          SET provider_order_id = $1,
              provider_session_id = $2,
              status = 'pending',
              updated_at = now()
        WHERE id = $3
        RETURNING order_id`,
      [checkout.providerOrderId, session, attemptId]
    )
    const orderId = attempt.rows[0]?.order_id
    if (!orderId) throw new Error("PAYMENT_ATTEMPT_NOT_FOUND")
    await client.query(
      `UPDATE orders
          SET payment_provider = $1,
              provider_order_id = $2,
              provider_session_id = $3,
              payment_status = 'pending',
              payment_error_code = NULL,
              updated_at = now()
        WHERE id = $4`,
      [checkout.provider, checkout.providerOrderId, session, orderId]
    )
  })
}

export function failPaymentAttempt(attemptId: string, code: string) {
  return transaction(async (client) => {
    const attempt = await client.query<{ order_id: string; provider_order_id: string }>(
      `UPDATE payment_attempts
          SET status = 'failed', error_code = $1, updated_at = now()
        WHERE id = $2
        RETURNING order_id, provider_order_id`,
      [code.slice(0, 200), attemptId]
    )
    const row = attempt.rows[0]
    if (!row) return
    await client.query(
      `UPDATE orders
          SET payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'failed' END,
              payment_error_code = CASE WHEN payment_status = 'paid' THEN payment_error_code ELSE $1 END,
              updated_at = now()
        WHERE id = $2 AND provider_order_id = $3`,
      [code.slice(0, 200), row.order_id, row.provider_order_id]
    )
  })
}

async function paymentAttemptForResult(client: PoolClient, result: ProviderPaymentResult) {
  const attempt = await client.query<PaymentAttemptRow>(
    `SELECT id, order_id, attempt_no, provider, provider_order_id, provider_session_id, provider_payment_id, status, created_at
       FROM payment_attempts
      WHERE provider = $1 AND provider_order_id = $2
      FOR UPDATE`,
    [result.provider, result.providerOrderId]
  )
  return attempt.rows[0] || null
}

export function applyProviderPaymentResult(result: ProviderPaymentResult) {
  return transaction(async (client) => {
    const attempt = await paymentAttemptForResult(client, result)
    if (!attempt) throw new Error("PAYMENT_ATTEMPT_NOT_FOUND")

    const orderResult = await client.query<{
      id: string
      public_id: string
      customer_account_id: string
      idempotency_key: string
      amount_paise: number
      subtotal_paise: number
      discount_paise: number
      campaign_id: string | null
      campaign_title: string | null
      tier_name: string
      customer_name: string
      phone: string
      payment_status: string
      status: string
      payment_attempt_count: number
    }>(
      `SELECT id, public_id, customer_account_id, idempotency_key, amount_paise, subtotal_paise, discount_paise,
              campaign_id, campaign_title, tier_name, customer_name, phone, payment_status, status, payment_attempt_count
         FROM orders WHERE id = $1 FOR UPDATE`,
      [attempt.order_id]
    )
    const orderRow = orderResult.rows[0]
    if (!orderRow) throw new Error("PAYMENT_ORDER_NOT_FOUND")
    if (result.amountPaise != null && result.amountPaise !== orderRow.amount_paise) throw new Error("PAYMENT_AMOUNT_MISMATCH")

    const eventInsert = await client.query<{ id: string }>(
      `INSERT INTO payment_events (id, provider, provider_event_id, order_id, event_type, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (provider, provider_event_id) DO NOTHING
       RETURNING id`,
      [randomUUID(), result.provider, result.eventId, orderRow.id, result.eventType, JSON.stringify(result.payload ?? {})]
    )

    if (eventInsert.rowCount) {
      await client.query(
        `UPDATE payment_attempts
            SET status = $1,
                provider_payment_id = COALESCE($2, provider_payment_id),
                error_code = $3,
                updated_at = now()
          WHERE id = $4`,
        [result.status, result.providerPaymentId, result.errorCode || null, attempt.id]
      )

      if (result.status === "paid") {
        const reference = result.providerPaymentId || result.providerOrderId
        const referenceHash = createHash(securityConfig.hashAlgorithm).update(reference).digest("hex")
        const previousStatus = orderRow.status
        const nextStatus = previousStatus === "payment_verification_pending" ? "payment_verified" : previousStatus
        await client.query(
          `UPDATE orders
              SET payment_provider = $1,
                  provider_order_id = $2,
                  provider_payment_id = COALESCE($3, provider_payment_id),
                  payment_reference = COALESCE(payment_reference, $4),
                  payment_reference_hash = COALESCE(payment_reference_hash, $5),
                  payment_status = 'paid',
                  payment_error_code = NULL,
                  paid_at = COALESCE(paid_at, now()),
                  status = $6,
                  updated_at = now()
            WHERE id = $7`,
          [result.provider, result.providerOrderId, result.providerPaymentId, reference, referenceHash, nextStatus, orderRow.id]
        )
        if (nextStatus !== previousStatus) {
          await client.query(
            `INSERT INTO order_events (id, order_id, event_type, payload)
             VALUES ($1,$2,'status_changed',$3::jsonb)`,
            [randomUUID(), orderRow.id, JSON.stringify({ from: previousStatus, to: nextStatus, source: "payment_gateway", provider: result.provider })]
          )
        }
      } else if (result.status === "failed" && orderRow.payment_status !== "paid") {
        await client.query(
          `UPDATE orders
              SET payment_status = CASE WHEN provider_order_id = $1 THEN 'failed' ELSE payment_status END,
                  payment_error_code = CASE WHEN provider_order_id = $1 THEN $2 ELSE payment_error_code END,
                  updated_at = now()
            WHERE id = $3`,
          [result.providerOrderId, result.errorCode || "PAYMENT_FAILED", orderRow.id]
        )
      }
    }

    const current = await client.query<{
      id: string
      public_id: string
      customer_account_id: string
      idempotency_key: string
      amount_paise: number
      subtotal_paise: number
      discount_paise: number
      campaign_id: string | null
      campaign_title: string | null
      tier_name: string
      customer_name: string
      phone: string
      payment_status: string
      status: string
      payment_attempt_count: number
    }>(
      `SELECT id, public_id, customer_account_id, idempotency_key, amount_paise, subtotal_paise, discount_paise,
              campaign_id, campaign_title, tier_name, customer_name, phone, payment_status, status, payment_attempt_count
         FROM orders WHERE id = $1`,
      [orderRow.id]
    )
    return mapSnapshot(current.rows[0])
  })
}

export function paymentOrderClientResult(order: PaymentOrderSnapshot) {
  return {
    orderId: order.publicId,
    trackingToken: createTrackingToken(order.idempotencyKey),
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    payablePaise: order.amountPaise,
    campaignId: order.campaignId,
    campaignTitle: order.campaignTitle,
    paymentStatus: order.paymentStatus,
    status: order.status
  }
}
