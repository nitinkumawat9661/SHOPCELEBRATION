import { paymentConfig } from "../../config/payment"

const formatter = new Intl.NumberFormat(paymentConfig.locale, {
  style: "currency",
  currency: paymentConfig.currencyCode,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

export function formatMoney(value: number) {
  return formatter.format(value)
}
