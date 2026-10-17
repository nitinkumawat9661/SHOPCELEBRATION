import { NextResponse } from "next/server"
import { getAdminAccessState } from "../../../../../lib/security/admin-session"
import { adminPasskeyCount } from "../../../../../lib/server/admin-passkeys"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { validation } from "../../../../../config/validation"

export const dynamic = "force-dynamic"
const privateHeaders = { "Cache-Control": "private, no-store" }

/**
 * Administrative overview only. Do not expose WebAuthn credential IDs,
 * public keys, user handle, sign counters, secrets or cookie contents.
 */
export async function GET(request: Request) {
  try {
    const access = await getAdminAccessState()
    if (!access.authenticated || !access.passkeyEnabled || access.method !== "passkey") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders })
    }
    if (!await consumeRequestRateLimit("admin-v3-security-read", request, validation.rateLimits.adminMutation)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: privateHeaders })
    }
    const passkeyCount = await adminPasskeyCount()
    return NextResponse.json({
      ok: true,
      sessionMethod: "passkey",
      passkeyCount,
      passwordFallbackAllowed: false,
      credentialManagementAvailable: false,
      selfServicePasskeyRecoveryAvailable: false
    }, { headers: privateHeaders })
  } catch (error) {
    console.error("admin-v3-security-status", error)
    return NextResponse.json({ ok: false, error: "SECURITY_STATUS_UNAVAILABLE" },
      { status: 503, headers: privateHeaders })
  }
}
