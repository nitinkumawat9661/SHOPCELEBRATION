import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { ShipwayApiError, quoteShipwayShipping } from "../../../../lib/server/shipway"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

type QuoteRequest = {
  pincode?: unknown
  quantity?: unknown
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("shipping-quote", request, validation.rateLimits.createOrder)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<QuoteRequest>(request)
    const pincode = String(body.pincode ?? "").replace(/\D/g, "")
    const quantity = Number(body.quantity)
    if (!/^\d{6}$/.test(pincode)) return NextResponse.json({ ok: false, error: "INVALID_SHIPPING_PINCODE" }, { status: 422 })
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) {
      return NextResponse.json({ ok: false, error: "INVALID_SHIPPING_QUANTITY" }, { status: 422 })
    }

    const quote = await quoteShipwayShipping({
      toPincode: pincode,
      weightGrams: quantity * 80
    })
    return NextResponse.json({
      ok: true,
      shippingPaise: quote.shippingPaise,
      carrierName: quote.carrierName || null,
      billedWeightKg: quote.billedWeightKg
    })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof ShipwayApiError) {
      const status = ["SHIPWAY_NO_SERVICEABLE_CARRIER", "INVALID_SHIPPING_PINCODE"].includes(error.code) ? 422 : 503
      return NextResponse.json({ ok: false, error: error.code }, { status })
    }
    console.error("shipping-quote", error)
    return NextResponse.json({ ok: false, error: "SHIPWAY_RATE_UNAVAILABLE" }, { status: 503 })
  }
}
