import { NextResponse } from "next/server"
import { validation } from "../../../config/validation"
import { findOrderByTrackingToken } from "../../../lib/server/orders"
import { createPackingVideoViewUrl } from "../../../lib/server/r2"
import { consumeRequestRateLimit } from "../../../lib/server/rate-limit"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../lib/security/request"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const body = await readJsonBody<{ token?: unknown }>(request)
    const token = typeof body.token === "string" ? body.token.trim() : ""
    if (token.length < validation.trackingToken.min || token.length > validation.trackingToken.max) return NextResponse.json({ ok: false, error: "INVALID_TRACKING_TOKEN" }, { status: 400 })

    const allowed = await consumeRequestRateLimit("track", request, validation.rateLimits.trackOrder)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const order = await findOrderByTrackingToken(token)
    if (!order) return NextResponse.json({ ok: false, error: "ORDER_NOT_FOUND" }, { status: 404 })

    let packingVideoUrl: string | null = null
    if (order.packingVideoKey) {
      try {
        packingVideoUrl = await createPackingVideoViewUrl(order.packingVideoKey)
      } catch (error) {
        console.error("packing-video-view-url", error)
      }
    }
    return NextResponse.json({
      ok: true,
      order: {
        orderType: order.orderType,
        lineItems: order.lineItems,
        publicId: order.publicId,
        amountPaise: order.amountPaise,
        tierName: order.tierName,
        requiredDate: order.requiredDate,
        occasion: order.occasion,
        status: order.status,
        paymentStatus: order.paymentStatus,
        receiverName: order.receiverName,
        packingVideoUrl,
        shippingProvider: order.shippingProvider,
        shippingTrackingNumber: order.shippingTrackingNumber,
        customerApprovedAt: order.customerApprovedAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("track-order", error)
    return NextResponse.json({ ok: false, error: "TRACKING_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
