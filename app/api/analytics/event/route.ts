import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { recordConversionEvent } from "../../../../lib/server/conversion-analytics"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export const dynamic = "force-dynamic"

type EventInput = {
  sessionId?: unknown
  eventName?: unknown
  tierId?: unknown
  campaignId?: unknown
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("conversion-event", request, validation.rateLimits.analyticsEvent)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<EventInput>(request)
    const session = await getCustomerSession()
    const recorded = await recordConversionEvent({
      sessionId: body.sessionId,
      eventName: body.eventName,
      tierId: body.tierId,
      campaignId: body.campaignId,
      customerAccountId: session?.accountId || null
    })
    if (!recorded) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 422 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("conversion-event", error)
    return NextResponse.json({ ok: false, error: "ANALYTICS_UNAVAILABLE" }, { status: 503 })
  }
}
