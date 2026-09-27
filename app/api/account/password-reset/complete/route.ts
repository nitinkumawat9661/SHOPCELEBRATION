import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { createCustomerSession, customerCookieOptions, CUSTOMER_COOKIE_NAME } from "../../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { CustomerAccountError } from "../../../../../lib/server/customer-accounts"
import { completePasswordReset, PasswordResetError } from "../../../../../lib/server/password-reset"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("password-reset-complete", request, validation.rateLimits.passwordResetComplete)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ resetToken?: unknown; password?: unknown }>(request)
    const result = await completePasswordReset(body)
    const response = NextResponse.json({ ok: true, account: { ...result.accountView, phoneVerified: false } }, { headers: { "Cache-Control": "no-store" } })
    response.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSession(result.account.id, result.account.sessionVersion), customerCookieOptions())
    return response
  } catch (error) {
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof PasswordResetError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("password-reset-complete", error)
    return NextResponse.json({ ok: false, error: "PASSWORD_RESET_UNAVAILABLE" }, { status: 503 })
  }
}
