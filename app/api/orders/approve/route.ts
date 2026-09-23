import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { approvePackingVideo } from "../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("customer-action", request, validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ token?: unknown }>(request)
    const token = typeof body.token === "string" ? body.token.trim() : ""
    if (token.length < validation.trackingToken.min || token.length > validation.trackingToken.max) {
      return NextResponse.json({ ok: false, error: "INVALID_TRACKING_TOKEN" }, { status: 400 })
    }

    const result = await approvePackingVideo(token)
    if (!result.ok) return NextResponse.json(result, { status: result.code === "ORDER_NOT_FOUND" ? 404 : 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("approve-packing", error)
    return NextResponse.json({ ok: false, error: "APPROVAL_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
