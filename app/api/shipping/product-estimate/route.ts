import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isIndividuallySellable } from "../../../../lib/domain/catalog"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { getCatalogConfig } from "../../../../lib/server/catalog"
import { ShipwayApiError, quoteShipwayShipping } from "../../../../lib/server/shipway"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }
const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status, headers })

/** Product-page estimate is informational only. No shipment is created, no
 * customer details are collected, and checkout rechecks serviceability.
 * Jewellery weight matches the current checkout's 80g/item assumption.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("product-pincode-estimate", request, validation.rateLimits.createOrder)
    if (!allowed) return fail("RATE_LIMITED", 429)
    const body = await readJsonBody<{ pincode?: unknown; productId?: unknown }>(request, 1500)
    const pincode = body?.pincode
    if (typeof pincode !== "string" || !/^\d{6}$/.test(pincode)) return fail("INVALID_SHIPPING_PINCODE", 422)
    const id = body?.productId
    if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id)) return fail("INVALID_PRODUCT_ID", 422)

    const { catalog } = await getCatalogConfig()
    const product = catalog.products.find(item => item.id === id && item.active !== false)
    if (!product || !isIndividuallySellable(product)) return fail("PRODUCT_NOT_AVAILABLE", 404)

    const quote = await quoteShipwayShipping({ toPincode: pincode, weightGrams: 80 })
    return NextResponse.json({
      ok: true,
      serviceable: true,
      estimatedDeliveryDate: quote.estimatedDeliveryDate,
      estimatedTransitDays: quote.estimatedTransitDays
    }, { headers })
  } catch (error) {
    if (error instanceof RequestSecurityError) return fail(error.code, error.status)
    if (error instanceof ShipwayApiError) {
      if (error.code === "SHIPWAY_NO_SERVICEABLE_CARRIER") return fail("NOT_SERVICEABLE", 422)
      return fail("DELIVERY_CHECK_UNAVAILABLE", 503)
    }
    console.error("product-pincode-estimate", error)
    return fail("DELIVERY_CHECK_UNAVAILABLE", 503)
  }
}
