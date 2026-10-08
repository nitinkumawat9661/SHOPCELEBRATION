import { NextResponse } from "next/server"
import { env } from "../../../../../../config/env"
import { securityConfig } from "../../../../../../config/security"
import { validation } from "../../../../../../config/validation"
import { isAdminRequest } from "../../../../../../lib/security/admin-session"
import { ADMIN_PASSKEY_CHALLENGE_COOKIE, createPasskeyChallenge, registrationOptions } from "../../../../../../lib/security/admin-webauthn"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../../lib/security/request"
import { getOrCreateAdminUserHandle, listAdminCredentialDescriptors } from "../../../../../../lib/server/admin-passkeys"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-passkey-register-options", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const [userHandle, excludeCredentials] = await Promise.all([getOrCreateAdminUserHandle(), listAdminCredentialDescriptors()])
    const challenge = createPasskeyChallenge("register")
    const response = NextResponse.json({ ok: true, options: registrationOptions({ challenge: challenge.challenge, userHandle, excludeCredentials }) })
    response.cookies.set(ADMIN_PASSKEY_CHALLENGE_COOKIE, challenge.token, {
      httpOnly: true, secure: env.isProduction, sameSite: securityConfig.cookieSameSite as "strict" | "lax" | "none",
      path: "/api/admin/passkeys", maxAge: challenge.maxAge
    })
    return response
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-passkey-register-options", error)
    return NextResponse.json({ ok: false, error: "PASSKEY_SETUP_UNAVAILABLE" }, { status: 503 })
  }
}
