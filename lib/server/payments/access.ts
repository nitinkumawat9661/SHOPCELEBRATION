import type { PaymentProviderName } from "../../../config/payment-gateway"
import { query } from "../db"

export async function paymentAttemptBelongsToCustomer(input: {
  provider: PaymentProviderName
  providerOrderId: string
  publicOrderId: string
  customerAccountId: string
}) {
  const result = await query<{ ok: boolean }>(
    `SELECT true AS ok
       FROM payment_attempts pa
       JOIN orders o ON o.id = pa.order_id
      WHERE pa.provider = $1
        AND pa.provider_order_id = $2
        AND o.public_id = $3
        AND o.customer_account_id = $4
      LIMIT 1`,
    [input.provider, input.providerOrderId, input.publicOrderId, input.customerAccountId]
  )
  return Boolean(result.rows[0]?.ok)
}

export async function paymentAttemptPublicOrderId(input: {
  provider: PaymentProviderName
  providerOrderId: string
  customerAccountId: string
}) {
  const result = await query<{ public_id: string }>(
    `SELECT o.public_id
       FROM payment_attempts pa
       JOIN orders o ON o.id = pa.order_id
      WHERE pa.provider = $1
        AND pa.provider_order_id = $2
        AND o.customer_account_id = $3
      ORDER BY pa.attempt_no DESC
      LIMIT 1`,
    [input.provider, input.providerOrderId, input.customerAccountId]
  )
  return result.rows[0]?.public_id || null
}
