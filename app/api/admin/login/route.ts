import { NextResponse } from "next/server"
import { env } from "../../../../config/env"
import { securityConfig } from "../../../../config/security"
import { validation } from "../../../../config/validation"
import { ADMIN_COOKIE_NAME, createAdminSession, verifyAdminPassword } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-login", request, validation.rateLimits.adminLogin)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ password?: unknown }>(request)
    const password = typeof body.password === "string" ? body.password : ""
    if (!verifyAdminPassword(password)) return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSession(), {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: securityConfig.cookieSameSite as "strict" | "lax" | "none",
      path: "/",
      maxAge: validation.adminSessionTtlSeconds
    })
    return response
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-login", error)
    return NextResponse.json({ ok: false, error: "ADMIN_LOGIN_UNAVAILABLE" }, { status: 503 })
  }
}
