import { paymentConfig } from "../../config/payment"

export function isPaymentConfirmed(paymentStatus: string, orderStatus?: string) {
  return paymentStatus === "paid" || paymentStatus === "verified" || orderStatus === "payment_verified"
}

export function assertPaymentCanStart(orderStatus: string) {
  if (orderStatus === "cancelled") throw new Error("PAYMENT_ORDER_CANCELLED")
}

export function toMinorUnits(amount: number) {
  return Math.round(amount * paymentConfig.minorUnitFactor)
}

export function fromMinorUnits(amount: number) {
  return amount / paymentConfig.minorUnitFactor
}

export function buildUpiUrl(input: { upiId: string; upiName: string; amountRupees: number; note: string }) {
  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.upiName,
    am: String(input.amountRupees),
    cu: paymentConfig.currencyCode,
    tn: input.note
  })
  return `${paymentConfig.upiScheme}?${params.toString()}`
}
