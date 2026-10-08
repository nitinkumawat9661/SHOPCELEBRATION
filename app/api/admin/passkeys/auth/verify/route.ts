import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { env } from "../../../../../../config/env"
import { securityConfig } from "../../../../../../config/security"
import { validation } from "../../../../../../config/validation"
import { ADMIN_COOKIE_NAME, createAdminSession } from "../../../../../../lib/security/admin-session"
import { ADMIN_PASSKEY_CHALLENGE_COOKIE, verifyAuthentication, verifyPasskeyChallenge } from "../../../../../../lib/security/admin-webauthn"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../../lib/security/request"
import { findAdminPasskey, updateAdminPasskeyUsage } from "../../../../../../lib/server/admin-passkeys"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

type AuthenticationBody = { id?: unknown }

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-passkey-auth-verify", request, validation.rateLimits.adminLogin)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<AuthenticationBody & Record<string, unknown>>(request)
    const credentialId = typeof body.id === "string" ? body.id : ""
    if (!credentialId || credentialId.length > 2048) return NextResponse.json({ ok: false, error: "INVALID_PASSKEY_ID" }, { status: 400 })
    const stored = await findAdminPasskey(credentialId)
    if (!stored) return NextResponse.json({ ok: false, error: "INVALID_PASSKEY" }, { status: 401 })
    const challenge = verifyPasskeyChallenge((await cookies()).get(ADMIN_PASSKEY_CHALLENGE_COOKIE)?.value, "authenticate")
    const verified = verifyAuthentication(body as Parameters<typeof verifyAuthentication>[0], challenge, {
      credentialId: stored.credential_id,
      userHandle: stored.user_handle,
      publicKeyJwk: stored.public_key_jwk,
      signCount: Number(stored.sign_count)
    })
    await updateAdminPasskeyUsage({
      credentialId: stored.credential_id,
      signCount: verified.signCount,
      backupState: verified.backupState
    })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSession("passkey"), {
      httpOnly: true, secure: env.isProduction, sameSite: securityConfig.cookieSameSite as "strict" | "lax" | "none",
      path: "/", maxAge: validation.adminSessionTtlSeconds
    })
    response.cookies.set(ADMIN_PASSKEY_CHALLENGE_COOKIE, "", {
      httpOnly: true, secure: env.isProduction, sameSite: securityConfig.cookieSameSite as "strict" | "lax" | "none",
      path: "/api/admin/passkeys", maxAge: 0
    })
    return response
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    const code = error instanceof Error ? error.message : "PASSKEY_LOGIN_FAILED"
    console.error("admin-passkey-auth-verify", code)
    return NextResponse.json({ ok: false, error: code }, { status: 401 })
  }
}
