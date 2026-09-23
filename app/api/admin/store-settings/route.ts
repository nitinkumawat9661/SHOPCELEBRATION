import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { getStoreSettings, saveStoreSettings, StoreSettingsError } from "../../../../lib/server/store-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await getStoreSettings()) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-store-settings", error)
    return NextResponse.json({ ok: false, error: "SETTINGS_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-store-settings", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ settings?: unknown }>(request)
    return NextResponse.json({ ok: true, ...(await saveStoreSettings(body.settings)) })
  } catch (error) {
    if (error instanceof StoreSettingsError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-store-settings-save", error)
    return NextResponse.json({ ok: false, error: "SETTINGS_SAVE_FAILED" }, { status: 503 })
  }
}
