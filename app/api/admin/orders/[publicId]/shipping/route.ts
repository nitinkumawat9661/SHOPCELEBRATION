import { NextResponse } from "next/server"
import { validation } from "../../../../../../config/validation"
import { isAdminRequest } from "../../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../../lib/security/request"
import { bookOrderWithShipway, setShippingDetails } from "../../../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"
import { sanitizeText } from "../../../../../../lib/validation/text"

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-mutation", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ mode?: unknown; provider?: unknown; trackingNumber?: unknown; weightGrams?: unknown; lengthCm?: unknown; breadthCm?: unknown; heightCm?: unknown }>(request)
    const publicId = (await context.params).publicId
    if (body.mode === "shipway") {
      const packed = {
        weightGrams: Number(body.weightGrams),
        lengthCm: Number(body.lengthCm),
        breadthCm: Number(body.breadthCm),
        heightCm: Number(body.heightCm)
      }
      if (!Object.values(packed).every(Number.isInteger)) return NextResponse.json({ ok: false, error: "INVALID_SHIPPING_PACKAGE" }, { status: 422 })
      const result = await bookOrderWithShipway(publicId, packed)
      const status = result.ok ? 200 : result.code === "ORDER_NOT_FOUND" ? 404 : ["SHIPPING_UPDATE_NOT_ALLOWED", "PACKING_APPROVAL_REQUIRED"].includes(result.code) ? 409 : ["INVALID_SHIPPING_WEIGHT", "INVALID_SHIPPING_DIMENSIONS"].includes(result.code) ? 422 : 502
      return NextResponse.json(result, { status })
    }

    const provider = sanitizeText(body.provider, validation.shipping.providerMax)
    const trackingNumber = sanitizeText(body.trackingNumber, validation.shipping.trackingMax)
    if (!provider || !trackingNumber) return NextResponse.json({ ok: false, error: "INVALID_SHIPPING_DETAILS" }, { status: 422 })

    const result = await setShippingDetails(publicId, provider, trackingNumber)
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "ORDER_NOT_FOUND" ? 404 : 409 })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-shipping", error)
    return NextResponse.json({ ok: false, error: "SHIPPING_UPDATE_FAILED" }, { status: 503 })
  }
}
