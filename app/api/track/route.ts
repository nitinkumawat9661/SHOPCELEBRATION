import { NextResponse } from "next/server"
import { validation } from "../../../config/validation"
import { findOrderByTrackingToken, updateOrderStatus } from "../../../lib/server/orders"
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


    let shippingCourierName: string | null = null
    if (order.shippingProvider === "Shipway" && order.shippingTrackingNumber && !["cancelled", "delivered", "issue_reported", "refund_or_replacement_resolved"].includes(order.status)) {
      try {
        const live = await getShipwayTracking(order.shippingTrackingNumber)
        shippingCourierName = live?.courierName || null
        const remote = live?.shipmentStatus?.toUpperCase() || ""
        const preDispatch = ["payment_verification_pending", "payment_verified", "preparing", "packing_video_ready", "customer_approved"].includes(order.status)
        const pickedUpOrMoving = ["PKP", "INT", "UND", "DEX", "DRE", "CRTA", "CNA", "ODA", "SMD", "OTH"].includes(remote)

        if ((remote === "CAN" || remote === "PCAN") && preDispatch) {
          await updateOrderStatus(order.publicId, "cancelled")
          order = await findOrderByTrackingToken(token) || order
        } else if (pickedUpOrMoving && preDispatch) {
          const moved = await updateOrderStatus(order.publicId, "shipped")
          if (moved.ok) order = await findOrderByTrackingToken(token) || order
        } else if (remote === "OOD" || remote === "OFD") {
          if (preDispatch) {
            const moved = await updateOrderStatus(order.publicId, "shipped")
            if (moved.ok) order = await findOrderByTrackingToken(token) || order
          }
          if (order.status === "shipped") {
            await updateOrderStatus(order.publicId, "out_for_delivery")
            order = await findOrderByTrackingToken(token) || order
          }
        } else if (remote === "DEL") {
          if (preDispatch) {
            const moved = await updateOrderStatus(order.publicId, "shipped")
            if (moved.ok) order = await findOrderByTrackingToken(token) || order
          }
          if (order.status === "shipped") {
            await updateOrderStatus(order.publicId, "out_for_delivery")
            order = await findOrderByTrackingToken(token) || order
          }
          if (order.status === "out_for_delivery") {
            await updateOrderStatus(order.publicId, "delivered")
            order = await findOrderByTrackingToken(token) || order
          }
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
