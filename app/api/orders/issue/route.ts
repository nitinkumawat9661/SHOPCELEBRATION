import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { storeContent } from "../../../../lib/domain/content"
import { reportOrderIssue } from "../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { sanitizeText } from "../../../../lib/validation/text"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("customer-action", request, validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ token?: unknown; issueType?: unknown; note?: unknown }>(request)
    const token = sanitizeText(body.token, validation.trackingToken.max)
    const issueType = sanitizeText(body.issueType, validation.issue.typeMax)
    const note = sanitizeText(body.note, validation.issue.noteMax)
    if (token.length < validation.trackingToken.min || !storeContent.issues.types.includes(issueType) || note.length < validation.issue.noteMin) {
      return NextResponse.json({ ok: false, error: "INVALID_ISSUE_REPORT" }, { status: 422 })
    }

    const result = await reportOrderIssue(token, issueType, note)
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "ORDER_NOT_FOUND" ? 404 : 409 })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("report-issue", error)
    return NextResponse.json({ ok: false, error: "ISSUE_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
