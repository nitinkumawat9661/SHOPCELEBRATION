import { NextResponse } from "next/server"
import { paymentGatewayConfig, paymentGatewayReady } from "../../../../config/payment-gateway"
import { routes } from "../../../../config/routes"
import { validation } from "../../../../config/validation"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { findCustomerAccountById } from "../../../../lib/server/customer-accounts"
import { createProviderCheckout, type ProviderCheckout } from "../../../../lib/server/payments/provider"
import { bindPaymentAttempt, failPaymentAttempt, getPaymentOrder, paymentOrderClientResult, reservePaymentAttempt } from "../../../../lib/server/payments/store"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

type RetryBody = { publicOrderId?: unknown }

function reusableCheckout(input: {
  provider: "razorpay" | "cashfree"
  providerOrderId: string
  providerSessionId: string | null
  amountPaise: number
}): ProviderCheckout {
  if (input.provider === "razorpay") {
    return {
      provider: "razorpay",
      mode: paymentGatewayConfig.mode,
      providerOrderId: input.providerOrderId,
      keyId: paymentGatewayConfig.razorpay.keyId,
      amountPaise: input.amountPaise,
      currency: "INR"
    }
  }
  if (!input.providerSessionId) throw new Error("PAYMENT_SESSION_MISSING")
  return {
    provider: "cashfree",
    mode: paymentGatewayConfig.mode,
    providerOrderId: input.providerOrderId,
    paymentSessionId: input.providerSessionId,
    amountPaise: input.amountPaise,
    currency: "INR"
  }
}

export async function POST(request: Request) {
  let attemptId = ""
  try {
    enforceSameOrigin(request)
    if (!paymentGatewayReady() || !paymentGatewayConfig.provider) {
      return NextResponse.json({ ok: false, error: "PAYMENT_GATEWAY_NOT_CONFIGURED" }, { status: 503 })
    }

    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

    const allowed = await consumeRequestRateLimit("payment-retry", request, validation.rateLimits.createOrder)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<RetryBody>(request)
    const publicOrderId = typeof body.publicOrderId === "string" ? body.publicOrderId.trim() : ""
    if (!publicOrderId) return NextResponse.json({ ok: false, error: "PAYMENT_ORDER_NOT_FOUND" }, { status: 404 })

    const existing = await getPaymentOrder(publicOrderId, account.id)
    if (!existing) return NextResponse.json({ ok: false, error: "PAYMENT_ORDER_NOT_FOUND" }, { status: 404 })

    const clientExisting = paymentOrderClientResult(existing)
    if (existing.paymentStatus === "paid" || existing.status === "payment_verified") {
      return NextResponse.json({
        ok: true,
        paid: true,
        ...clientExisting,
        trackingPath: `${routes.track}?token=${encodeURIComponent(clientExisting.trackingToken)}`
      })
    }

    const reserved = await reservePaymentAttempt(publicOrderId, account.id, paymentGatewayConfig.provider)
    attemptId = reserved.attemptId
    const clientOrder = paymentOrderClientResult(reserved.order)

    let checkout: ProviderCheckout
    if (reserved.reusable) {
      checkout = reusableCheckout({
        provider: reserved.reusable.provider,
        providerOrderId: reserved.reusable.providerOrderId,
        providerSessionId: reserved.reusable.providerSessionId,
        amountPaise: reserved.order.amountPaise
      })
    } else {
      checkout = await createProviderCheckout({
        publicOrderId: reserved.order.publicId,
        providerReference: reserved.providerReference,
        amountPaise: reserved.order.amountPaise,
        customerAccountId: account.id,
        customerName: account.displayName,
        customerPhone: account.phone
      })
      await bindPaymentAttempt(reserved.attemptId, checkout)
    }

    return NextResponse.json({
      ok: true,
      paid: false,
      ...clientOrder,
      trackingPath: `${routes.track}?token=${encodeURIComponent(clientOrder.trackingToken)}`,
      checkout
    })
  } catch (error) {
    if (attemptId) {
      const code = error instanceof Error ? error.message : "PAYMENT_PROVIDER_UNAVAILABLE"
      await failPaymentAttempt(attemptId, code).catch(() => undefined)
    }
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    const code = error instanceof Error ? error.message : "PAYMENT_PROVIDER_UNAVAILABLE"
    console.error("retry-payment", error)
    return NextResponse.json({ ok: false, error: code }, { status: code === "PAYMENT_ATTEMPT_INITIALIZING" ? 409 : 503 })
  }
}
