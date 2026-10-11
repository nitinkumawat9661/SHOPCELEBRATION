import { courierProgressStatus, displayCourierStatus, type CourierPublicStatus } from "../../domain/courier-tracking"
import type { OrderStatus } from "../../domain/order-status"
import { getShipwayTracking } from "../shipway"
import { updateOrderStatus } from "./status"

export type CourierEligibleOrder = {
  publicId: string
  orderType: "hamper" | "individual"
  status: OrderStatus
  paymentStatus: string
  shippingProvider: string | null
  shippingTrackingNumber: string | null
}

export type CourierSyncResult = {
  status: OrderStatus
  courier: CourierPublicStatus | null
  courierUnavailable: boolean
}

/**
 * The same courier reconciliation is used by token tracking and by the signed-in
 * customer dashboard. It NEVER marks "shipped" from an AWB/pickup request,
 * cancels/refunds a paid order because the shipping leg failed, or treats an
 * estimated delivery date as a Delivered scan.
 */
export async function syncOrderCourier(order: CourierEligibleOrder): Promise<CourierSyncResult> {
  if (order.status === "cancelled" || !order.shippingTrackingNumber ||
      order.shippingProvider?.trim().toLowerCase() !== "shipway") {
    return { status: order.status, courier: null, courierUnavailable: false }
  }

  let live: Awaited<ReturnType<typeof getShipwayTracking>> = null
  let courierUnavailable = false
  if (!["delivered", "issue_reported", "refund_or_replacement_resolved"].includes(order.status)) {
    try {
      live = await getShipwayTracking(order.shippingTrackingNumber)
      courierUnavailable = !live
    } catch (error) {
      courierUnavailable = true
      console.error("shipway-courier-sync", {
        orderId: order.publicId,
        code: error instanceof Error ? error.message : "SHIPWAY_ERROR"
      })
    }
  }

  let status = order.status
  const carrierProgress = courierProgressStatus(live?.shipmentStatus || "")
  const isPaid = ["paid", "verified", "success"].includes(order.paymentStatus.trim().toLowerCase())
  const dispatchAllowed = isPaid && (order.orderType === "individual" ? status === "preparing" : status === "customer_approved")
  const advance = async (next: "shipped" | "out_for_delivery" | "delivered") => {
    const result = await updateOrderStatus(order.publicId, next)
    if (result.ok) status = next
    else console.warn("courier-order-transition-rejected", { orderId: order.publicId, from: status, to: next, code: result.code })
  }

  if (carrierProgress && isPaid) {
    try {
      if (dispatchAllowed) await advance("shipped")
      if ((carrierProgress === "out_for_delivery" || carrierProgress === "delivered") && status === "shipped") {
        await advance("out_for_delivery")
      }
      if (carrierProgress === "delivered" && status === "out_for_delivery") await advance("delivered")
    } catch (error) {
      console.error("courier-order-sync-update", {
        orderId: order.publicId,
        code: error instanceof Error ? error.message : "UPDATE_FAILED"
      })
    }
  }

  return {
    status,
    courier: displayCourierStatus(live, status, order.shippingTrackingNumber),
    courierUnavailable
  }
}
