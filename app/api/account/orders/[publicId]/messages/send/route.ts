import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../../../../lib/server/rate-limit"
import { consumeRateLimit } from "../../../../../../../lib/server/rate-limit"
import { validation } from "../../../../../../../config/validation"
import { sendCustomerOrderMessage } from "../../../../../../../lib/server/telegram-order-messages"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
type Context = { params: Promise<{ publicId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
    const [byIp, byAccount] = await Promise.all([
      consumeRequestRateLimit("customer-order-chat", request, validation.rateLimits.customerMutation),
      consumeRateLimit("customer-order-chat-account:" + session.accountId, 60, 6)
    ])
    if (!byIp || !byAccount) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers })
    const body = await readJsonBody<{ text?: unknown; requestId?: unknown }>(request, 4096)
    const { publicId } = await context.params
    const result = await sendCustomerOrderMessage(
      publicId, session.accountId,
      typeof body?.text === "string" ? body.text : "",
      typeof body?.requestId === "string" ? body.requestId : ""
    )
    if (!result.ok) {
      const status = result.reason === "ORDER_NOT_FOUND" ? 404 : result.reason === "MESSAGE_CONFLICT" ? 409 : 422
      return NextResponse.json({ ok: false, error: result.reason }, { status, headers })
    }
    return NextResponse.json({ ok: true, message: result.message }, { headers })
  } catch (error) {
    if (error instanceof RequestSecurityError)
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers })
    console.error("customer-chat-send", error instanceof Error ? error.message : "ERROR")
    return NextResponse.json({ ok: false, error: "MESSAGE_SERVICE_UNAVAILABLE" }, { status: 503, headers })
  }
}
