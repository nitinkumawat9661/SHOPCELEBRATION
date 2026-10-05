import { NextResponse } from "next/server"
import { validation } from "../../../../../../config/validation"
import { getCustomerSession } from "../../../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../../lib/security/request"
import { findCustomerAccountById } from "../../../../../../lib/server/customer-accounts"
import { approvePackingVideoForAccount, bookOrderWithShipway } from "../../../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

    const allowed = await consumeRequestRateLimit("customer-account-approve", request, validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const publicId = String((await params).publicId || "").trim()
    if (!publicId || publicId.length > validation.publicOrderIdMax) {
      return NextResponse.json({ ok: false, error: "INVALID_ORDER_ID" }, { status: 400 })
    }

    const result = await approvePackingVideoForAccount(publicId, account.id)
    if (!result.ok) return NextResponse.json(result, { status: result.code === "ORDER_NOT_FOUND" ? 404 : 409 })

    try {
      const shipping = await bookOrderWithShipway(publicId)
      if (shipping.ok) {
        return NextResponse.json({ ok: true, status: shipping.status, shippingBooked: true, awb: shipping.awb })
      }
      console.error("account-auto-book-shipway", { publicId, code: shipping.code })
      return NextResponse.json({ ok: true, status: result.status, shippingBooked: false, shippingError: shipping.code })
    } catch (error) {
      console.error("account-auto-book-shipway", { publicId, error })
      return NextResponse.json({ ok: true, status: result.status, shippingBooked: false, shippingError: "SHIPWAY_UNAVAILABLE" })
    }
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("account-approve-packing", error)
    return NextResponse.json({ ok: false, error: "APPROVAL_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
