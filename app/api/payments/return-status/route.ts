import { NextResponse } from "next/server"
import { routes } from "../../../../config/routes"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { paymentAttemptPublicOrderId } from "../../../../lib/server/payments/access"
import { getPaymentOrder, paymentOrderClientResult } from "../../../../lib/server/payments/store"

export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

  const providerOrderId = new URL(request.url).searchParams.get("providerOrderId")?.trim() || ""
  if (!providerOrderId) return NextResponse.json({ ok: false, error: "PAYMENT_ORDER_NOT_FOUND" }, { status: 404 })

  const publicOrderId = await paymentAttemptPublicOrderId({
    provider: "cashfree",
    providerOrderId,
    customerAccountId: session.accountId
  })
  if (!publicOrderId) return NextResponse.json({ ok: false, error: "PAYMENT_ORDER_NOT_FOUND" }, { status: 404 })

  const order = await getPaymentOrder(publicOrderId, session.accountId)
  if (!order) return NextResponse.json({ ok: false, error: "PAYMENT_ORDER_NOT_FOUND" }, { status: 404 })

  const client = paymentOrderClientResult(order)
  return NextResponse.json({
    ok: true,
    paid: order.paymentStatus === "paid" || order.status === "payment_verified",
    ...client,
    trackingPath: `${routes.track}?token=${encodeURIComponent(client.trackingToken)}`
  })
}
