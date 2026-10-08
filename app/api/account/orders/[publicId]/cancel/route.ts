import { NextResponse } from "next/server"
import { validation } from "../../../../../../../config/validation"
import { getCustomerSession } from "../../../../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../../../lib/security/request"
import { findCustomerAccountById } from "../../../../../../../lib/server/customer-accounts"
import { cancelCustomerOrder } from "../../../../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../../../../lib/server/rate-limit"

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

    const allowed = await consumeRequestRateLimit("customer-cancel", request, validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const result = await cancelCustomerOrder((await context.params).publicId, account.id)
    const status = result.ok
      ? 200
      : result.code === "ORDER_NOT_FOUND"
        ? 404
        : ["ORDER_CANCELLATION_NOT_ALLOWED", "ORDER_ALREADY_SHIPPED"].includes(result.code)
          ? 409
          : 503
    return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("customer-order-cancel", error)
    return NextResponse.json({ ok: false, error: "ORDER_CANCELLATION_FAILED" }, { status: 503 })
  }
}
