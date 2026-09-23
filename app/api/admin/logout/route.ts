import { NextResponse } from "next/server"
import { env } from "../../../../config/env"
import { securityConfig } from "../../../../config/security"
import { ADMIN_COOKIE_NAME } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../lib/security/request"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_COOKIE_NAME, "", { httpOnly: true, secure: env.isProduction, sameSite: securityConfig.cookieSameSite as "strict" | "lax" | "none", path: "/", maxAge: 0 })
    return response
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    return NextResponse.json({ ok: false, error: "LOGOUT_FAILED" }, { status: 500 })
  }
}
