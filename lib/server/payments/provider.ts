import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { paymentGatewayConfig, requirePaymentGateway, type PaymentMode, type PaymentProviderName } from "../../../config/payment-gateway"

export type ProviderCheckout =
  | {
      provider: "razorpay"
      mode: PaymentMode
      providerOrderId: string
      keyId: string
      amountPaise: number
      currency: "INR"
    }
  | {
      provider: "cashfree"
      mode: PaymentMode
      providerOrderId: string
      paymentSessionId: string
      amountPaise: number
      currency: "INR"
    }

export type ProviderPaymentResult = {
  provider: PaymentProviderName
  providerOrderId: string
  providerPaymentId: string | null
  status: "paid" | "pending" | "failed"
  amountPaise: number | null
  eventId: string
  eventType: string
  payload: unknown
  errorCode?: string | null
}

type CreateCheckoutInput = {
  publicOrderId: string
  providerReference: string
  amountPaise: number
  customerAccountId: string
  customerName: string
  customerPhone: string
}

function secureEqual(expected: string, received: string) {
  const left = Buffer.from(expected)
  const right = Buffer.from(received)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = { raw: text }
  }
  if (!response.ok) {
    const error = new Error(`PAYMENT_PROVIDER_HTTP_${response.status}`) as Error & { providerPayload?: unknown }
    error.providerPayload = parsed
    throw error
  }
  return parsed as T
}

function razorpayAuth() {
  const config = requirePaymentGateway()
  const token = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString("base64")
  return `Basic ${token}`
}

function cashfreeBaseUrl() {
  return paymentGatewayConfig.mode === "live" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg"
}

function cashfreeHeaders() {
  const config = requirePaymentGateway()
  return {
    "Content-Type": "application/json",
    "x-client-id": config.cashfree.appId,
    "x-client-secret": config.cashfree.secretKey,
    "x-api-version": config.cashfree.apiVersion
  }
}

export async function createProviderCheckout(input: CreateCheckoutInput): Promise<ProviderCheckout> {
  const config = requirePaymentGateway()

  if (config.provider === "razorpay") {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: razorpayAuth(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: "INR",
        receipt: input.providerReference.slice(0, 40),
        notes: {
          celebration_order_id: input.publicOrderId,
          customer_account_id: input.customerAccountId
        }
      }),
      cache: "no-store"
    })
    const order = await readJson<{ id: string; amount: number }>(response)
    if (!order.id || order.amount !== input.amountPaise) throw new Error("PAYMENT_PROVIDER_ORDER_INVALID")
    return {
      provider: "razorpay",
      mode: config.mode,
      providerOrderId: order.id,
      keyId: config.razorpay.keyId,
      amountPaise: input.amountPaise,
      currency: "INR"
    }
  }

  const response = await fetch(`${cashfreeBaseUrl()}/orders`, {
    method: "POST",
    headers: cashfreeHeaders(),
    body: JSON.stringify({
      order_id: input.providerReference.slice(0, 45),
      order_amount: input.amountPaise / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerAccountId.slice(0, 50),
        customer_name: input.customerName.slice(0, 100),
        customer_phone: input.customerPhone
      },
      order_meta: {
        return_url: `${config.appBaseUrl}/?payment_return=1&order_id={order_id}`,
        notify_url: `${config.appBaseUrl}/api/payments/webhook/cashfree`
      },
      order_note: `Celebration ${input.publicOrderId}`
    }),
    cache: "no-store"
  })
  const order = await readJson<{ order_id: string; payment_session_id: string }>(response)
  if (!order.order_id || !order.payment_session_id) throw new Error("PAYMENT_PROVIDER_ORDER_INVALID")
  return {
    provider: "cashfree",
    mode: config.mode,
    providerOrderId: order.order_id,
    paymentSessionId: order.payment_session_id,
    amountPaise: input.amountPaise,
    currency: "INR"
  }
}

async function fetchRazorpayPayment(paymentId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: razorpayAuth() },
    cache: "no-store"
  })
  return readJson<{ id: string; order_id: string; amount: number; status: string; captured?: boolean }>(response)
}

async function fetchCashfreePayments(providerOrderId: string) {
  const response = await fetch(`${cashfreeBaseUrl()}/orders/${encodeURIComponent(providerOrderId)}/payments`, {
    headers: cashfreeHeaders(),
    cache: "no-store"
  })
  return readJson<Array<{ cf_payment_id?: string | number; payment_status?: string; payment_amount?: number; payment_message?: string }>>(response)
}

export async function verifyProviderReturn(input: {
  provider: PaymentProviderName
  providerOrderId: string
  providerPaymentId?: string
  signature?: string
}): Promise<ProviderPaymentResult> {
  const config = requirePaymentGateway()
  if (config.provider !== input.provider) throw new Error("PAYMENT_PROVIDER_MISMATCH")

  if (input.provider === "razorpay") {
    if (!input.providerPaymentId || !input.signature) throw new Error("PAYMENT_CONFIRMATION_INVALID")
    const expected = createHmac("sha256", config.razorpay.keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest("hex")
    if (!secureEqual(expected, input.signature)) throw new Error("PAYMENT_SIGNATURE_INVALID")

    const payment = await fetchRazorpayPayment(input.providerPaymentId)
    if (payment.order_id !== input.providerOrderId) throw new Error("PAYMENT_ORDER_MISMATCH")
    return {
      provider: "razorpay",
      providerOrderId: payment.order_id,
      providerPaymentId: payment.id,
      status: payment.status === "captured" || payment.captured === true ? "paid" : payment.status === "failed" ? "failed" : "pending",
      amountPaise: payment.amount,
      eventId: `return:${payment.id}:${payment.status}`,
      eventType: `checkout.${payment.status}`,
      payload: { id: payment.id, order_id: payment.order_id, amount: payment.amount, status: payment.status }
    }
  }

  const payments = await fetchCashfreePayments(input.providerOrderId)
  const paid = payments.find((item) => item.payment_status === "SUCCESS")
  const latest = paid || payments[0]
  const providerPaymentId = latest?.cf_payment_id != null ? String(latest.cf_payment_id) : null
  const status = paid ? "paid" : latest?.payment_status === "FAILED" || latest?.payment_status === "USER_DROPPED" ? "failed" : "pending"
  return {
    provider: "cashfree",
    providerOrderId: input.providerOrderId,
    providerPaymentId,
    status,
    amountPaise: typeof latest?.payment_amount === "number" ? Math.round(latest.payment_amount * 100) : null,
    eventId: `return:${providerPaymentId || input.providerOrderId}:${latest?.payment_status || "PENDING"}`,
    eventType: `checkout.${latest?.payment_status || "PENDING"}`,
    payload: latest || { order_id: input.providerOrderId },
    errorCode: status === "failed" ? latest?.payment_message || "PAYMENT_FAILED" : null
  }
}

export function verifyProviderWebhook(provider: PaymentProviderName, rawBody: string, headers: Headers): ProviderPaymentResult {
  const config = requirePaymentGateway()
  if (config.provider !== provider) throw new Error("PAYMENT_PROVIDER_MISMATCH")

  if (provider === "razorpay") {
    const received = headers.get("x-razorpay-signature") || ""
    const expected = createHmac("sha256", config.razorpay.webhookSecret).update(rawBody).digest("hex")
    if (!received || !config.razorpay.webhookSecret || !secureEqual(expected, received)) throw new Error("PAYMENT_WEBHOOK_SIGNATURE_INVALID")
    const body = JSON.parse(rawBody) as {
      event?: string
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string; error_code?: string } }
        order?: { entity?: { id?: string; amount_paid?: number; status?: string } }
      }
    }
    const eventType = body.event || "unknown"
    const payment = body.payload?.payment?.entity
    const order = body.payload?.order?.entity
    const providerOrderId = payment?.order_id || order?.id || ""
    if (!providerOrderId) throw new Error("PAYMENT_WEBHOOK_ORDER_MISSING")
    const status = eventType === "payment.captured" || eventType === "order.paid" ? "paid" : eventType === "payment.failed" ? "failed" : "pending"
    const eventId = headers.get("x-razorpay-event-id") || createHash("sha256").update(rawBody).digest("hex")
    return {
      provider,
      providerOrderId,
      providerPaymentId: payment?.id || null,
      status,
      amountPaise: typeof payment?.amount === "number" ? payment.amount : typeof order?.amount_paid === "number" ? order.amount_paid : null,
      eventId,
      eventType,
      payload: body,
      errorCode: payment?.error_code || null
    }
  }

  const signature = headers.get("x-webhook-signature") || ""
  const timestamp = headers.get("x-webhook-timestamp") || ""
  const expected = createHmac("sha256", config.cashfree.webhookSecret).update(`${timestamp}${rawBody}`).digest("base64")
  if (!signature || !timestamp || !config.cashfree.webhookSecret || !secureEqual(expected, signature)) throw new Error("PAYMENT_WEBHOOK_SIGNATURE_INVALID")
  const body = JSON.parse(rawBody) as {
    type?: string
    data?: {
      order?: { order_id?: string; order_amount?: number }
      payment?: { cf_payment_id?: string | number; payment_status?: string; payment_amount?: number; payment_message?: string }
    }
  }
  const eventType = body.type || "unknown"
  const payment = body.data?.payment
  const providerOrderId = body.data?.order?.order_id || ""
  if (!providerOrderId) throw new Error("PAYMENT_WEBHOOK_ORDER_MISSING")
  const paymentStatus = payment?.payment_status || ""
  const status = paymentStatus === "SUCCESS" || eventType.includes("SUCCESS") ? "paid" : paymentStatus === "FAILED" || paymentStatus === "USER_DROPPED" || eventType.includes("FAILED") ? "failed" : "pending"
  const providerPaymentId = payment?.cf_payment_id != null ? String(payment.cf_payment_id) : null
  return {
    provider,
    providerOrderId,
    providerPaymentId,
    status,
    amountPaise: typeof payment?.payment_amount === "number" ? Math.round(payment.payment_amount * 100) : typeof body.data?.order?.order_amount === "number" ? Math.round(body.data.order.order_amount * 100) : null,
    eventId: `${eventType}:${providerPaymentId || createHash("sha256").update(rawBody).digest("hex")}`,
    eventType,
    payload: body,
    errorCode: status === "failed" ? payment?.payment_message || "PAYMENT_FAILED" : null
  }
}
