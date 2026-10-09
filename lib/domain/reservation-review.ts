export type ReservationReviewStatus = "active" | "payment_review" | "terminal_cleanup" | "paid_stock_review"

export function reservationReviewStatus(input: {
  expiresAt: string
  paymentStatus: string
  orderStatus: string
}, nowMs = Date.now()): ReservationReviewStatus {
  // An unresolved payment must NEVER be treated as failed simply because
  // its inventory lease is old. Provider settlement/webhooks can arrive late.
  if (input.paymentStatus === "paid" || input.paymentStatus === "verified" || input.orderStatus === "payment_verified") {
    return "paid_stock_review"
  }
  if (input.orderStatus === "cancelled" || input.paymentStatus === "failed") return "terminal_cleanup"
  const expiry = Date.parse(input.expiresAt)
  if (Number.isFinite(expiry) && expiry <= nowMs) return "payment_review"
  return "active"
}
