import { NextResponse } from "next/server"
import { requireEnv } from "../../../../config/env"
import { paymentGatewayConfig, paymentGatewayReady } from "../../../../config/payment-gateway"
import { routes } from "../../../../config/routes"
import { validation } from "../../../../config/validation"
import { normalizeOrderInput, OrderValidationError, type CreateOrderInput } from "../../../../lib/domain/order"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { CampaignError } from "../../../../lib/server/campaigns"
import { getCatalogConfig } from "../../../../lib/server/catalog"
import { findCustomerAccountById } from "../../../../lib/server/customer-accounts"
import { createOrder } from "../../../../lib/server/orders"
import { createProviderCheckout, type ProviderCheckout } from "../../../../lib/server/payments/provider"
import { bindPaymentAttempt, failPaymentAttempt, getPaymentOrder, paymentOrderClientResult, reservePaymentAttempt } from "../../../../lib/server/payments/store"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { quoteShipwayShipping, ShipwayApiError } from "../../../../lib/server/shipway"

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
  let savedOrder: { publicId: string; customerAccountId: string } | null = null
  try {
    enforceSameOrigin(request)
    if (!paymentGatewayReady() || !paymentGatewayConfig.provider) {
      return NextResponse.json({ ok: false, error: "PAYMENT_GATEWAY_NOT_CONFIGURED" }, { status: 503 })
    }

    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

    const allowed = await consumeRequestRateLimit("payment-create", request, validation.rateLimits.createOrder)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<CreateOrderInput>(request)
    const { catalog } = await getCatalogConfig()
    const order = normalizeOrderInput(
      { ...body, phone: account.phone },
      requireEnv("businessTimezone"),
      catalog,
      { requirePaymentReference: false, checkExpectedSubtotal: false }
    )

    const shippingQuote = order.orderType === "individual"
      ? await quoteShipwayShipping({
          toPincode: order.pincode,
          weightGrams: order.lineItems.reduce((total, item) => total + item.quantity * 80, 0)
        })
      : null

    const created = await createOrder(order, account.id, body.offerQuoteId, {
      paymentProvider: paymentGatewayConfig.provider,
      shippingPaise: shippingQuote?.shippingPaise
    })
    savedOrder = { publicId: created.publicId, customerAccountId: account.id }
    const reserved = await reservePaymentAttempt(created.publicId, account.id, paymentGatewayConfig.provider)
    attemptId = reserved.attemptId
    const clientOrder = paymentOrderClientResult(reserved.order)

    if (reserved.order.paymentStatus === "paid" || reserved.order.status === "payment_verified") {
      return NextResponse.json({
        ok: true,
        paid: true,
        ...clientOrder,
        trackingPath: `${routes.track}#order=${encodeURIComponent(clientOrder.trackingToken)}`
      })
    }

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
      trackingPath: `${routes.track}#order=${encodeURIComponent(clientOrder.trackingToken)}`,
      checkout
    })
  } catch (error) {
    if (attemptId) {
      const code = error instanceof Error ? error.message : "PAYMENT_PROVIDER_UNAVAILABLE"
      await failPaymentAttempt(attemptId, code).catch(() => undefined)
    }
    if (error instanceof OrderValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof ShipwayApiError) {
      const status = ["SHIPWAY_NO_SERVICEABLE_CARRIER", "INVALID_SHIPPING_PINCODE"].includes(error.code) ? 422 : 503
      return NextResponse.json({ ok: false, error: error.code }, { status })
    }
    if (error instanceof CampaignError) {
      const status = ["OFFER_QUOTE_EXPIRED", "OFFER_QUOTE_USED"].includes(error.code) ? 409 : 422
      return NextResponse.json({ ok: false, error: error.code }, { status })
    }
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    const code = error instanceof Error ? error.message : "PAYMENT_PROVIDER_UNAVAILABLE"
    const snapshot = savedOrder ? await getPaymentOrder(savedOrder.publicId, savedOrder.customerAccountId).catch(() => null) : null
    const clientOrder = snapshot ? paymentOrderClientResult(snapshot) : null
    console.error("create-payment", error)
    return NextResponse.json({ ok: false, error: code, ...(clientOrder ? { ...clientOrder, trackingPath: `${routes.track}#order=${encodeURIComponent(clientOrder.trackingToken)}` } : {}) }, { status: ["PAYMENT_ATTEMPT_INITIALIZING", "PAYMENT_ORDER_CANCELLED", "PAYMENT_ALREADY_CONFIRMED"].includes(code) ? 409 : 503 })
  }
}
