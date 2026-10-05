import { NextResponse } from "next/server"
import { validation } from "../../../config/validation"
import { bookOrderWithShipway, findOrderByTrackingToken, updateOrderStatus } from "../../../lib/server/orders"
import { getShipwayTracking } from "../../../lib/server/shipway"
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

    let order = await findOrderByTrackingToken(token)
    if (!order) return NextResponse.json({ ok: false, error: "ORDER_NOT_FOUND" }, { status: 404 })

    if (order.status === "customer_approved" && !order.shippingTrackingNumber) {
      try {
        const autoBooking = await bookOrderWithShipway(order.publicId)
        if (!autoBooking.ok) console.error("shipway-auto-retry", { publicId: order.publicId, code: autoBooking.code })
        order = await findOrderByTrackingToken(token) || order
      } catch (error) {
        console.error("shipway-auto-retry", { publicId: order.publicId, error })
      }
    }

    let shippingLiveStatus: string | null = null
    let shippingCourierName: string | null = null
    let shippingTrackUrl: string | null = null
    if (order.shippingProvider === "Shipway" && order.shippingTrackingNumber && (order.status === "shipped" || order.status === "out_for_delivery")) {
      try {
        const live = await getShipwayTracking(order.shippingTrackingNumber)
        shippingLiveStatus = live?.currentStatus || live?.shipmentStatus || null
        shippingCourierName = live?.courierName || null
        shippingTrackUrl = live?.trackUrl || null
        if ((live?.shipmentStatus === "OOD" || live?.shipmentStatus === "OFD") && order.status === "shipped") {
          await updateOrderStatus(order.publicId, "out_for_delivery")
          order = await findOrderByTrackingToken(token) || order
        } else if (live?.shipmentStatus === "DEL") {
          if (order.status === "shipped") await updateOrderStatus(order.publicId, "out_for_delivery")
          await updateOrderStatus(order.publicId, "delivered")
          order = await findOrderByTrackingToken(token) || order
        }
      } catch (error) {
        console.error("shipway-tracking-sync", error)
      }
    }

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
        shippingTrackingNumber: order.shippingTrackingNumber,
        shippingCourierName,
        customerApprovedAt: order.customerApprovedAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("track-order", error)
    return NextResponse.json({ ok: false, error: "TRACKING_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
