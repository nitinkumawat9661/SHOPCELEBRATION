import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { CustomerAccountError } from "../../../../../lib/server/customer-accounts"
import { PasswordResetError, verifyPasswordResetAccessToken } from "../../../../../lib/server/password-reset"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("password-reset-verify", request, validation.rateLimits.passwordResetVerify)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ phone?: unknown; accessToken?: unknown }>(request)
    const result = await verifyPasswordResetAccessToken(body)
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof PasswordResetError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("password-reset-verify", error)
    return NextResponse.json({ ok: false, error: "PASSWORD_RESET_UNAVAILABLE" }, { status: 503 })
  }
}
