import { NextResponse } from "next/server"
import { routes } from "../../../../config/routes"
import { validation } from "../../../../config/validation"
import { issueTrackingTokenForLookup } from "../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { isSafePublicOrderId } from "../../../../lib/validation/identifiers"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("track-lookup", request, validation.rateLimits.trackLookup)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ orderId?: unknown; phoneLastDigits?: unknown }>(request)
    const orderId = typeof body.orderId === "string" ? body.orderId.trim().toUpperCase() : ""
    const phoneLastDigits = typeof body.phoneLastDigits === "string" ? body.phoneLastDigits.replace(/\D/g, "") : ""

    if (!isSafePublicOrderId(orderId) || phoneLastDigits.length !== validation.trackingLookupPhoneDigits) {
      return NextResponse.json({ ok: false, error: "ORDER_LOOKUP_FAILED" }, { status: 400 })
    }

    const token = await issueTrackingTokenForLookup(orderId, phoneLastDigits)
    if (!token) return NextResponse.json({ ok: false, error: "ORDER_LOOKUP_FAILED" }, { status: 404 })

    return NextResponse.json({
      ok: true,
      trackingPath: `${routes.track}?token=${encodeURIComponent(token)}`
    })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("track-lookup", error)
    return NextResponse.json({ ok: false, error: "TRACKING_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
