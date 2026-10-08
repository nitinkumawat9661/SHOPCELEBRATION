import { normalizeCustomerPhone } from "./customer-accounts"
import { query } from "./db"
import { isSafePublicOrderId } from "../validation/identifiers"

export async function verifyClaimOrder(publicIdValue: unknown, phoneValue: unknown) {
  const publicId = String(publicIdValue ?? "").trim().toUpperCase()
  if (!isSafePublicOrderId(publicId)) return null
  const phone = normalizeCustomerPhone(phoneValue)
  const result = await query<{ public_id: string; status: string; delivered_at: Date | null }>(
    `SELECT public_id, status, delivered_at
       FROM orders
      WHERE public_id = $1 AND phone = $2
      LIMIT 1`,
    [publicId, phone]
  )
  const order = result.rows[0]
  if (!order || order.status === "cancelled") return null
  const deliveredAt = order.delivered_at
  const guaranteeEndsAt = deliveredAt ? new Date(deliveredAt) : null
  if (guaranteeEndsAt) guaranteeEndsAt.setMonth(guaranteeEndsAt.getMonth() + 6)
  return {
    publicId: order.public_id,
    delivered: Boolean(deliveredAt),
    deliveredAt: deliveredAt?.toISOString() || null,
    sixMonthGuaranteeActive: Boolean(guaranteeEndsAt && guaranteeEndsAt.getTime() >= Date.now()),
    guaranteeEndsAt: guaranteeEndsAt?.toISOString() || null
  }
}
