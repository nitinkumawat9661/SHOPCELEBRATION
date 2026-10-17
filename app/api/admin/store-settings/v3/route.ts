import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import {
  getStoreSettings, saveStoreSettingsVersioned, StoreSettingsError
} from "../../../../../lib/server/store-settings"

export const dynamic = "force-dynamic"
const privateHeaders = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders })
  }
  try {
    if (!await consumeRequestRateLimit("admin-v3-settings-read", request, validation.rateLimits.adminMutation)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: privateHeaders })
    }
    const result = await getStoreSettings()
    return NextResponse.json({ ok: true, ...result }, { headers: privateHeaders })
  } catch (error) {
    console.error("admin-v3-settings-read", error)
    return NextResponse.json({ ok: false, error: "SETTINGS_UNAVAILABLE" }, { status: 503, headers: privateHeaders })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders })
  }
  try {
    enforceSameOrigin(request)
    if (!await consumeRequestRateLimit("admin-v3-settings-write", request, validation.rateLimits.adminMutation)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: privateHeaders })
    }
    const body = await readJsonBody<{ settings?: unknown; expectedVersion?: unknown }>(request)
    const result = await saveStoreSettingsVersioned(body.settings, body.expectedVersion)
    return NextResponse.json({ ok: true, ...result }, { headers: privateHeaders })
  } catch (error) {
    if (error instanceof StoreSettingsError) {
      return NextResponse.json({ ok: false, error: error.code },
        { status: error.code === "SETTINGS_VERSION_CONFLICT" ? 409 : 422, headers: privateHeaders })
    }
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers: privateHeaders })
    }
    console.error("admin-v3-settings-write", error)
    return NextResponse.json({ ok: false, error: "SETTINGS_SAVE_FAILED" }, { status: 503, headers: privateHeaders })
  }
}
