import { NextResponse } from "next/server"
import { routes } from "../../../../config/routes"
import type { PaymentProviderName } from "../../../../config/payment-gateway"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { paymentAttemptBelongsToCustomer } from "../../../../lib/server/payments/access"
import { verifyProviderReturn } from "../../../../lib/server/payments/provider"
import { applyProviderPaymentResult, paymentOrderClientResult } from "../../../../lib/server/payments/store"

type VerifyBody = {
  publicOrderId?: unknown
  provider?: unknown
  providerOrderId?: unknown
  providerPaymentId?: unknown
  signature?: unknown
}

function providerName(value: unknown): PaymentProviderName | null {
  return value === "razorpay" || value === "cashfree" ? value : null
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const body = await readJsonBody<VerifyBody>(request)
    const provider = providerName(body.provider)
    const publicOrderId = typeof body.publicOrderId === "string" ? body.publicOrderId.trim() : ""
    const providerOrderId = typeof body.providerOrderId === "string" ? body.providerOrderId.trim() : ""
    const providerPaymentId = typeof body.providerPaymentId === "string" ? body.providerPaymentId.trim() : undefined
    const signature = typeof body.signature === "string" ? body.signature.trim() : undefined
    if (!provider || !publicOrderId || !providerOrderId) {
      return NextResponse.json({ ok: false, error: "PAYMENT_CONFIRMATION_INVALID" }, { status: 422 })
    }

    const owned = await paymentAttemptBelongsToCustomer({
      provider,
      providerOrderId,
      publicOrderId,
      customerAccountId: session.accountId
    })
    if (!owned) return NextResponse.json({ ok: false, error: "PAYMENT_ORDER_NOT_FOUND" }, { status: 404 })

    const result = await verifyProviderReturn({ provider, providerOrderId, providerPaymentId, signature })
    const order = await applyProviderPaymentResult(result)
    const client = paymentOrderClientResult(order)
    return NextResponse.json({
      ok: true,
      paid: order.paymentStatus === "paid" || order.status === "payment_verified",
      ...client,
      trackingPath: `${routes.track}?token=${encodeURIComponent(client.trackingToken)}`
    })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    const code = error instanceof Error ? error.message : "PAYMENT_CONFIRMATION_FAILED"
    console.error("verify-payment", error)
    return NextResponse.json({ ok: false, error: code }, { status: 422 })
  }
}
