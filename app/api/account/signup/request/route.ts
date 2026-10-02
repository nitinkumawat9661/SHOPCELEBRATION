import { NextResponse } from "next/server"
import { smsConfig, smsReady } from "../../../../../config/sms"
import { validation } from "../../../../../config/validation"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { CustomerAccountError, normalizeCustomerPhone } from "../../../../../lib/server/customer-accounts"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("customer-signup-otp", request, validation.rateLimits.customerSignup)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ phone?: unknown }>(request)
    normalizeCustomerPhone(body.phone)
    if (!smsReady()) return NextResponse.json({ ok: false, error: "SMS_OTP_UNAVAILABLE" }, { status: 503 })
    return NextResponse.json({
      ok: true,
      widgetId: smsConfig.msg91.widgetId,
      tokenAuth: smsConfig.msg91.widgetToken,
      expiresInSeconds: validation.passwordReset.otpTtlSeconds,
      resendAfterSeconds: validation.passwordReset.resendCooldownSeconds
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("customer-signup-otp-request", error)
    return NextResponse.json({ ok: false, error: "SMS_OTP_UNAVAILABLE" }, { status: 503 })
  }
}
