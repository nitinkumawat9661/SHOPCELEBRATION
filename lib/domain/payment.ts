import { paymentConfig } from "../../config/payment"

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
