import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../../lib/security/request"
import { acknowledgeCustomerOrderMessages, listCustomerOrderMessages } from "../../../../../../lib/server/telegram-order-messages"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"
import { validation } from "../../../../../../config/validation"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
type Context = { params: Promise<{ publicId: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
    const { publicId } = await context.params
    const result = await listCustomerOrderMessages(publicId, session.accountId)
    if (!result) return NextResponse.json({ ok: false, error: "ORDER_NOT_FOUND" }, { status: 404, headers })
    return NextResponse.json({ ok: true, orderId: publicId, ...result }, { headers })
  } catch (error) {
    console.error("telegram-customer-messages-read", error)
    return NextResponse.json({ ok: false, error: "MESSAGES_UNAVAILABLE" }, { status: 503, headers })
  }
}

// Acknowledge only. No customer-side outgoing message endpoint is enabled.
export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
    const allowed = await consumeRequestRateLimit("order-message-read", request, validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers })
    const { publicId } = await context.params
    const result = await acknowledgeCustomerOrderMessages(publicId, session.accountId)
    if (!result) return NextResponse.json({ ok: false, error: "ORDER_NOT_FOUND" }, { status: 404, headers })
    return NextResponse.json({ ok: true, ...result }, { headers })
  } catch (error) {
    if (error instanceof RequestSecurityError)
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers })
    console.error("telegram-customer-messages-acknowledge", error)
    return NextResponse.json({ ok: false, error: "MESSAGES_UNAVAILABLE" }, { status: 503, headers })
  }
}
