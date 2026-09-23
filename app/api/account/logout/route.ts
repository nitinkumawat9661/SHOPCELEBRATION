import { NextResponse } from "next/server"
import { CUSTOMER_COOKIE_NAME, customerCookieOptions } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../lib/security/request"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(CUSTOMER_COOKIE_NAME, "", { ...customerCookieOptions(), maxAge: 0 })
    return response
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    return NextResponse.json({ ok: false, error: "LOGOUT_FAILED" }, { status: 500 })
  }
}
