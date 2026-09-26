import { NextResponse } from "next/server"
import { routes } from "../../../../config/routes"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { getPaymentOrder, paymentOrderClientResult } from "../../../../lib/server/payments/store"

export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const publicOrderId = new URL(request.url).searchParams.get("orderId")?.trim() || ""
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
