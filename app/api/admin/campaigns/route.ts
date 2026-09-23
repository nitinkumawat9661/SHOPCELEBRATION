import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { CampaignError, getCampaignConfig, saveCampaignConfig } from "../../../../lib/server/campaigns"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await getCampaignConfig()) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-campaigns", error)
    return NextResponse.json({ ok: false, error: "CAMPAIGNS_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-campaigns", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ config?: unknown }>(request)
    return NextResponse.json({ ok: true, ...(await saveCampaignConfig(body.config)) })
  } catch (error) {
    if (error instanceof CampaignError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-campaigns-save", error)
    return NextResponse.json({ ok: false, error: "CAMPAIGNS_SAVE_FAILED" }, { status: 503 })
  }
}
