import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { createCustomerSession, customerCookieOptions, CUSTOMER_COOKIE_NAME } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { createCustomerAccount, CustomerAccountError } from "../../../../lib/server/customer-accounts"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("customer-signup", request, validation.rateLimits.customerSignup)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ phone?: unknown; password?: unknown; displayName?: unknown }>(request)
    const account = await createCustomerAccount(body)
    const response = NextResponse.json({ ok: true, account: { ...account, phoneVerified: false } }, { status: 201 })
    response.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSession(account.id), customerCookieOptions())
    return response
  } catch (error) {
    if (error instanceof CustomerAccountError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("customer-signup", error)
    return NextResponse.json({ ok: false, error: "ACCOUNT_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
