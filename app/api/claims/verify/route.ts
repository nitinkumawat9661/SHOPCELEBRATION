import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { CustomerAccountError } from "../../../../lib/server/customer-accounts"
import { verifyClaimOrder } from "../../../../lib/server/claims"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("claim-verify", request, validation.rateLimits.trackLookup)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ orderId?: unknown; phone?: unknown }>(request)
    const order = await verifyClaimOrder(body.orderId, body.phone)
    if (!order) return NextResponse.json({ ok: false, error: "CLAIM_ORDER_NOT_FOUND" }, { status: 404 })
    return NextResponse.json({ ok: true, order }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: "CLAIM_ORDER_NOT_FOUND" }, { status: 404 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("claim-verify", error)
    return NextResponse.json({ ok: false, error: "CLAIM_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
