import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { getSelfBuildAdminState, saveSelfBuildAdminState, SelfBuildAdminError } from "../../../../lib/server/self-build-admin"

// ADMIN ONLY. This staging endpoint intentionally has no corresponding
// public/customer API. Internal unit budget consumption must never be sent
// to a customer browser before a separate privacy/security review.
export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await getSelfBuildAdminState()) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("admin-self-build-get", error)
    return NextResponse.json({ ok: false, error: "SELF_BUILD_SETTINGS_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-self-build", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<unknown>(request, validation.catalogRequestMaxBytes)
    const state = await saveSelfBuildAdminState(body)
    return NextResponse.json({ ok: true, ...state }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof SelfBuildAdminError) return NextResponse.json({ ok: false, error: error.code }, { status: error.code === "STALE_SELF_BUILD_CONFIGURATION" ? 409 : 422 })
    console.error("admin-self-build-save", error)
    return NextResponse.json({ ok: false, error: "SELF_BUILD_SETTINGS_SAVE_FAILED" }, { status: 503 })
  }
}
