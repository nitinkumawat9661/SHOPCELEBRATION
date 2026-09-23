import { NextResponse } from "next/server"
import { validation } from "../../../config/validation"
import { CustomRequestValidationError, normalizeCustomHamperRequest, type CustomHamperRequestInput } from "../../../lib/domain/custom-request"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../lib/security/request"
import { createCustomHamperRequest } from "../../../lib/server/custom-requests"
import { consumeRequestRateLimit } from "../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("custom-hamper-request", request, validation.rateLimits.customRequest)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<CustomHamperRequestInput>(request)
    const normalized = normalizeCustomHamperRequest(body)
    const created = await createCustomHamperRequest(normalized)
    return NextResponse.json({ ok: true, requestId: created.id })
  } catch (error) {
    if (error instanceof CustomRequestValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("custom-hamper-request", error)
    return NextResponse.json({ ok: false, error: "REQUEST_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
