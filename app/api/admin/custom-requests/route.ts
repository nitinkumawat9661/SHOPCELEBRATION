import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { listCustomHamperRequests, updateCustomHamperRequestStatus } from "../../../../lib/server/custom-requests"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { sanitizeText } from "../../../../lib/validation/text"

const statuses = new Set(["new", "contacted", "closed"])

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, requests: await listCustomHamperRequests() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-custom-requests-get", error)
    return NextResponse.json({ ok: false, error: "REQUEST_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-custom-request", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ id?: unknown; status?: unknown }>(request)
    const id = sanitizeText(body.id, 80)
    const status = sanitizeText(body.status, 20)
    if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.has(status)) return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 422 })
    const updated = await updateCustomHamperRequestStatus(id, status as "new" | "contacted" | "closed")
    if (!updated) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
    return NextResponse.json({ ok: true, request: updated })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-custom-requests-patch", error)
    return NextResponse.json({ ok: false, error: "REQUEST_UPDATE_FAILED" }, { status: 503 })
  }
}
