import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { createCustomerSession, customerCookieOptions, CUSTOMER_COOKIE_NAME } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { continueVerifiedCustomer, createCustomerAccount, customerAccountView, CustomerAccountError, normalizeCustomerPhone } from "../../../../lib/server/customer-accounts"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { verifyMsg91AccessToken, SmsProviderError } from "../../../../lib/server/sms/provider"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("customer-signup", request, validation.rateLimits.customerSignup)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ phone?: unknown; password?: unknown; displayName?: unknown; accessToken?: unknown; passwordless?: unknown }>(request)
    const phone = normalizeCustomerPhone(body.phone)
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : ""
    if (!accessToken) return NextResponse.json({ ok: false, error: "PHONE_VERIFICATION_REQUIRED" }, { status: 401 })

    let verifiedPhone = ""
    try {
      const verified = await verifyMsg91AccessToken(accessToken)
      verifiedPhone = normalizeCustomerPhone(verified.identifier)
    } catch (error) {
      if (error instanceof SmsProviderError) {
        return NextResponse.json({ ok: false, error: error.code === "SMS_PROVIDER_UNAVAILABLE" ? "SMS_OTP_UNAVAILABLE" : "INVALID_OTP" }, { status: error.code === "SMS_PROVIDER_UNAVAILABLE" ? 503 : 401 })
      }
      throw error
    }
    if (verifiedPhone !== phone) return NextResponse.json({ ok: false, error: "INVALID_OTP" }, { status: 401 })

    const account = body.passwordless === true
      ? await continueVerifiedCustomer({ phone, displayName: body.displayName })
      : await createCustomerAccount({ ...body, phone })
    const response = NextResponse.json({ ok: true, account: customerAccountView(account) }, { status: body.passwordless === true ? 200 : 201 })
    response.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSession(account.id, account.sessionVersion), customerCookieOptions())
    return response
  } catch (error) {
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("customer-signup", error)
    return NextResponse.json({ ok: false, error: "ACCOUNT_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
