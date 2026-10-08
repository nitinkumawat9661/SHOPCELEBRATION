import { NextResponse } from "next/server"
import { env } from "../../../../../../config/env"
import { securityConfig } from "../../../../../../config/security"
import { validation } from "../../../../../../config/validation"
import { ADMIN_PASSKEY_CHALLENGE_COOKIE, authenticationOptions, createPasskeyChallenge } from "../../../../../../lib/security/admin-webauthn"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../../lib/security/request"
import { adminPasskeyExists } from "../../../../../../lib/server/admin-passkeys"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-passkey-auth-options", request, validation.rateLimits.adminLogin)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    if (!await adminPasskeyExists()) return NextResponse.json({ ok: false, error: "PASSKEY_NOT_CONFIGURED" }, { status: 409 })
    const challenge = createPasskeyChallenge("authenticate")
    const response = NextResponse.json({ ok: true, options: authenticationOptions(challenge.challenge) })
    response.cookies.set(ADMIN_PASSKEY_CHALLENGE_COOKIE, challenge.token, {
      httpOnly: true, secure: env.isProduction, sameSite: securityConfig.cookieSameSite as "strict" | "lax" | "none",
      path: "/api/admin/passkeys", maxAge: challenge.maxAge
    })
    return response
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-passkey-auth-options", error)
    return NextResponse.json({ ok: false, error: "PASSKEY_LOGIN_UNAVAILABLE" }, { status: 503 })
  }
}
