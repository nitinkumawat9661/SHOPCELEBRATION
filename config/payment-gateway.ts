export type PaymentProviderName = "razorpay" | "cashfree"
export type PaymentMode = "test" | "live"

const read = (key: string) => process.env[key]?.trim() || ""

function mode(): PaymentMode {
  return read("PAYMENT_MODE").toLowerCase() === "live" ? "live" : "test"
}

function provider(): PaymentProviderName | null {
  const value = read("PAYMENT_PROVIDER").toLowerCase()
  if (value === "razorpay" || value === "cashfree") return value
  return null
}

export const paymentGatewayConfig = {
  provider: provider(),
  mode: mode(),
  appBaseUrl: read("APP_BASE_URL"),
  razorpay: {
    keyId: read("RAZORPAY_KEY_ID"),
    keySecret: read("RAZORPAY_KEY_SECRET"),
    webhookSecret: read("RAZORPAY_WEBHOOK_SECRET")
  },
  cashfree: {
    appId: read("CASHFREE_APP_ID"),
    secretKey: read("CASHFREE_SECRET_KEY"),
    webhookSecret: read("CASHFREE_WEBHOOK_SECRET") || read("CASHFREE_SECRET_KEY"),
    apiVersion: read("CASHFREE_API_VERSION") || "2023-08-01"
  }
} as const

export function paymentGatewayReady() {
  if (!paymentGatewayConfig.provider || !paymentGatewayConfig.appBaseUrl) return false
  if (paymentGatewayConfig.provider === "razorpay") {
    return Boolean(
      paymentGatewayConfig.razorpay.keyId &&
      paymentGatewayConfig.razorpay.keySecret &&
      paymentGatewayConfig.razorpay.webhookSecret
    )
  }
  return Boolean(
    paymentGatewayConfig.cashfree.appId &&
    paymentGatewayConfig.cashfree.secretKey &&
    paymentGatewayConfig.cashfree.webhookSecret
  )
}

export function requirePaymentGateway() {
  if (!paymentGatewayConfig.provider) throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED")
  if (!paymentGatewayConfig.appBaseUrl) throw new Error("APP_BASE_URL_NOT_CONFIGURED")
  if (!paymentGatewayReady()) throw new Error("PAYMENT_PROVIDER_CREDENTIALS_MISSING")
  return paymentGatewayConfig
}
