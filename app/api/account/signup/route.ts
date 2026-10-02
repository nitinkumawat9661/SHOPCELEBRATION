import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { createCustomerSession, customerCookieOptions, CUSTOMER_COOKIE_NAME } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { createCustomerAccount, customerAccountView, CustomerAccountError, normalizeCustomerPhone } from "../../../../lib/server/customer-accounts"
import { SmsProviderError, verifySmsAccessToken } from "../../../../lib/server/sms/provider"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("customer-signup", request, validation.rateLimits.customerSignup)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ phone?: unknown; password?: unknown; displayName?: unknown; accessToken?: unknown }>(request)
    const phone = normalizeCustomerPhone(body.phone)
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : ""
    if (!accessToken) return NextResponse.json({ ok: false, error: "PHONE_VERIFICATION_REQUIRED" }, { status: 401 })

    const verified = await verifySmsAccessToken(accessToken)
    const verifiedPhone = normalizeCustomerPhone(verified.identifier)
    if (verifiedPhone !== phone) return NextResponse.json({ ok: false, error: "INVALID_OTP" }, { status: 401 })

    const account = await createCustomerAccount(body, verifiedPhone)
    const response = NextResponse.json({ ok: true, account: customerAccountView(account) }, { status: 201 })
    response.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSession(account.id, account.sessionVersion), customerCookieOptions())
    return response
  } catch (error) {
    if (error instanceof SmsProviderError) return NextResponse.json({ ok: false, error: error.code === "SMS_PROVIDER_UNAVAILABLE" || error.code === "SMS_OTP_UNAVAILABLE" ? "SMS_OTP_UNAVAILABLE" : "INVALID_OTP" }, { status: error.code === "SMS_PROVIDER_UNAVAILABLE" || error.code === "SMS_OTP_UNAVAILABLE" ? 503 : 401 })
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("customer-signup", error)
    return NextResponse.json({ ok: false, error: "ACCOUNT_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
