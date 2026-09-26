import { env } from "./env"

export type PaymentProviderName = "razorpay" | "cashfree"
export type PaymentMode = "test" | "live"

function mode(): PaymentMode {
  return env.paymentMode.toLowerCase() === "live" ? "live" : "test"
}

function provider(): PaymentProviderName | null {
  const value = env.paymentProvider.toLowerCase()
  if (value === "razorpay" || value === "cashfree") return value
  return null
}

export const paymentGatewayConfig = {
  provider: provider(),
  mode: mode(),
  appBaseUrl: env.appBaseUrl,
  razorpay: {
    keyId: env.razorpayKeyId,
    keySecret: env.razorpayKeySecret,
    webhookSecret: env.razorpayWebhookSecret
  },
  cashfree: {
    appId: env.cashfreeAppId,
    secretKey: env.cashfreeSecretKey,
    webhookSecret: env.cashfreeWebhookSecret || env.cashfreeSecretKey,
    apiVersion: env.cashfreeApiVersion || "2023-08-01"
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
