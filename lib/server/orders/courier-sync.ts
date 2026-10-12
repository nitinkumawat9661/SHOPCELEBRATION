import { courierProgressStatus, displayCourierStatus, type CourierPublicStatus } from "../../domain/courier-tracking"
import type { OrderStatus } from "../../domain/order-status"
import { getShipwayTracking, findExistingShipwayAwbByOrderId } from "../shipway"
import { unstable_cache } from "next/cache"
import { attachVerifiedShipwayAwb } from "./recover-shipment"
import { updateOrderStatus } from "./status"
import { recordCourierObservation } from "./courier-observations"

export type CourierEligibleOrder = {
  publicId: string
  orderType: "hamper" | "individual"
  status: OrderStatus
  paymentStatus: string
  shippingProvider: string | null
  shippingTrackingNumber: string | null
  createdAt?: string
}

export type CourierSyncResult = {
  status: OrderStatus
  courier: CourierPublicStatus | null
  courierUnavailable: boolean
  trackingNumber: string | null
  recoveryAttempted: boolean
}

// Cache negative Shipway order lookups briefly to avoid calling the carrier on
// every account refresh. The authenticated lookup returns only the AWB.
// Next caches each exact merchant order id separately.
const cachedShipwayOrderAwb = unstable_cache(
  async (publicId: string) => findExistingShipwayAwbByOrderId(publicId),
  ["celebration-shipway-exact-order-recovery-v1"],
  { revalidate: 120 }
)

/**
 * The same courier reconciliation is used by token tracking and by the signed-in
 * customer dashboard. It NEVER marks "shipped" from an AWB/pickup request,
 * cancels/refunds a paid order because the shipping leg failed, or treats an
 * estimated delivery date as a Delivered scan.
 */
export async function syncOrderCourier(
  order: CourierEligibleOrder,
  options: { recoverUnlinkedShipment?: boolean } = {}
): Promise<CourierSyncResult> {
  let trackingNumber = order.shippingTrackingNumber
  let provider = order.shippingProvider
  let recoveryAttempted = false
  const isPaid = ["paid","verified","success"].includes(order.paymentStatus.trim().toLowerCase())
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : NaN
  const recent = Number.isFinite(createdAt) && createdAt <= Date.now() &&
    Date.now() - createdAt <= 45 * 24 * 60 * 60 * 1000
  const recoverableStatus = order.orderType === "individual"
    ? ["preparing","shipped","out_for_delivery"].includes(order.status)
    : ["customer_approved","shipped","out_for_delivery"].includes(order.status)

  if (!trackingNumber && isPaid && recent && recoverableStatus &&
      (!provider || provider.trim().toLowerCase() === "shipway") &&
      options.recoverUnlinkedShipment !== false) {
    recoveryAttempted = true
    try {
      const confirmedAwb = await cachedShipwayOrderAwb(order.publicId)
      if (confirmedAwb && await attachVerifiedShipwayAwb(order.publicId, confirmedAwb)) {
        trackingNumber = confirmedAwb
        provider = "Shipway"
      }
    } catch (error) {
      // Missing carrier credentials or a temporary carrier failure should
      // never hide a legitimate paid order or mutate its current status.
      console.error("shipway-exact-order-recovery", {
        orderId: order.publicId,
        code: error instanceof Error ? error.message : "RECOVERY_UNAVAILABLE"
      })
    }
  }

  if (order.status === "cancelled" || !trackingNumber ||
      provider?.trim().toLowerCase() !== "shipway") {
    return {
      status: order.status, courier: null, courierUnavailable: false,
      trackingNumber, recoveryAttempted
    }
  }

  let live: Awaited<ReturnType<typeof getShipwayTracking>> = null
  let courierUnavailable = false
  if (!["delivered", "issue_reported", "refund_or_replacement_resolved"].includes(order.status)) {
    try {
      live = await getShipwayTracking(trackingNumber)
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

  // Best-effort, idempotent Telegram event capture; a notification storage
  // failure must NEVER disrupt the customer's live tracking response.
  if (live && trackingNumber) {
    try {
      await recordCourierObservation(order.publicId, trackingNumber, live, status)
    } catch (error) {
      console.error("telegram-courier-observation", {
        orderId: order.publicId,
        code: error instanceof Error ? error.message : "OBSERVATION_UNAVAILABLE"
      })
    }
  }

  return {
    status,
    courier: displayCourierStatus(live, status, trackingNumber),
    trackingNumber,
    recoveryAttempted,
    courierUnavailable
  }
}
