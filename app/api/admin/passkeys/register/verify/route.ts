import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { env } from "../../../../../../config/env"
import { securityConfig } from "../../../../../../config/security"
import { validation } from "../../../../../../config/validation"
import { ADMIN_COOKIE_NAME, createAdminSession, isAdminRequest } from "../../../../../../lib/security/admin-session"
import { ADMIN_PASSKEY_CHALLENGE_COOKIE, verifyPasskeyChallenge, verifyRegistration } from "../../../../../../lib/security/admin-webauthn"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../../lib/security/request"
import { getOrCreateAdminUserHandle, saveAdminPasskey } from "../../../../../../lib/server/admin-passkeys"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-passkey-register-verify", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<unknown>(request)
    const challenge = verifyPasskeyChallenge((await cookies()).get(ADMIN_PASSKEY_CHALLENGE_COOKIE)?.value, "register")
    const userHandle = await getOrCreateAdminUserHandle()
    const credential = verifyRegistration(body as Parameters<typeof verifyRegistration>[0], challenge, userHandle)
    await saveAdminPasskey(credential)

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
    const code = error instanceof Error ? error.message : "PASSKEY_REGISTRATION_FAILED"
    console.error("admin-passkey-register-verify", code)
    return NextResponse.json({ ok: false, error: code }, { status: 400 })
  }
}
