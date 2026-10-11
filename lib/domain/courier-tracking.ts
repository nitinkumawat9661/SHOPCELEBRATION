import type { OrderStatus } from "./order-status"

/**
 * Customer-facing shipment stages represent carrier scans, not the merchant's
 * packing workflow. Pickup request (OFP/SCH) does not prove carrier pickup.
 * Statuses are mapped from Shipway's forward-shipment codebook.
 */
export type CourierStage =
  | "pickup_requested" | "picked_up" | "in_transit"
  | "out_for_delivery" | "delivered" | "exception" | "returning"

export type CourierScan = {
  status: string
  location: string | null
  occurredAt: string | null
  details: string | null
}

export type CourierPublicStatus = {
  stage: CourierStage
  code: string
  label: string
  description: string
  lastLocation: string | null
  latestScanAt: string | null
  scans: CourierScan[]
  courierName: string | null
  trackUrl: string | null
  estimatedDeliveryDate: string | null
  checkedAt: string
}

export type CarrierTrackingInput = {
  shipmentStatus: string
  currentStatus: string
  courierName: string | null
  trackUrl: string | null
  estimatedDeliveryDate: string | null
  scans?: CourierScan[]
}

const PICKUP_BOOKED = new Set(["SCH", "OFP", "NFI", "NFIDS"])
const PICKED_UP = new Set(["PKP"])
const IN_TRANSIT = new Set(["INT"])
const DELIVERY_TODAY = new Set(["OOD", "OFD"])
const DELIVERY_ISSUES = new Set(["UND", "ONH", "NWI", "DNB", "ODA", "OTH", "SMD", "CRTA", "CNA", "DEX", "DRE", "PNR", "LOST", "PKF", "PCAN", "FDR", "22", "23", "24", "25", "CAN"])
const RETURNING = new Set(["RTO", "RTD"])

function stageFor(code: string): CourierStage | null {
  if (code === "DEL") return "delivered"
  if (DELIVERY_TODAY.has(code)) return "out_for_delivery"
  if (PICKED_UP.has(code)) return "picked_up"
  if (IN_TRANSIT.has(code)) return "in_transit"
  if (RETURNING.has(code)) return "returning"
  if (DELIVERY_ISSUES.has(code)) return "exception"
  if (PICKUP_BOOKED.has(code)) return "pickup_requested"
  return null
}

export function courierProgressStatus(code: string): "shipped" | "out_for_delivery" | "delivered" | null {
  const clean = code.toUpperCase().trim()
  if (clean === "PKP" || clean === "INT") return "shipped"
  if (DELIVERY_TODAY.has(clean)) return "out_for_delivery"
  if (clean === "DEL") return "delivered"
  return null
}

export function displayCourierStatus(
  live: CarrierTrackingInput | null,
  orderStatus: OrderStatus,
  trackingNumber: string | null,
  checkedAt = new Date().toISOString()
): CourierPublicStatus | null {
  if (!trackingNumber || orderStatus === "cancelled") return null
  const code = (live?.shipmentStatus || "").trim().toUpperCase()
  // Do not replace order progress with a less advanced stale provider scan.
  const syncedStage: CourierStage | null =
    ["delivered", "issue_reported", "refund_or_replacement_resolved"].includes(orderStatus) ? "delivered" :
    orderStatus === "out_for_delivery" ? "out_for_delivery" :
    orderStatus === "shipped" ? "picked_up" : null
  const carrierStage = stageFor(code)
  const stage = carrierStage === "exception" || carrierStage === "returning"
    ? carrierStage
    : syncedStage === "delivered" ? "delivered"
    : syncedStage === "out_for_delivery" && carrierStage !== "delivered" ? "out_for_delivery"
    : syncedStage === "picked_up" && (!carrierStage || carrierStage === "pickup_requested") ? "picked_up"
    : carrierStage || syncedStage || "pickup_requested"

  const descriptions: Record<CourierStage, { label: string; description: string }> = {
    pickup_requested: { label: "Pickup requested", description: "Courier booking received. Waiting for an actual pickup scan." },
    picked_up: { label: "Picked up", description: "The courier has collected the parcel." },
    in_transit: { label: "In transit", description: "The parcel is moving through the courier network." },
    out_for_delivery: { label: "Out for delivery", description: "The courier has marked the parcel out for delivery. Arriving today is expected, not guaranteed." },
    delivered: { label: "Delivered", description: "The courier has confirmed delivery." },
    exception: { label: "Courier update needed", description: "The courier has reported a delivery or pickup issue. Check the latest scan." },
    returning: { label: "Returning to sender", description: "The courier has marked the parcel for return. Contact support if needed." }
  }
  const details = descriptions[stage]
  const scans = (live?.scans || []).slice(0, 12)
  const firstWithLocation = scans.find(s => s.location && s.location.trim())
  const firstWithTime = scans.find(s => s.occurredAt)
  const exceptionLabels: Record<string, string> = {
    PKF:"Pickup failed", PCAN:"Pickup cancelled", UND:"Delivery attempt unsuccessful",
    DRE:"Delivery rescheduled", DEX:"Delivery exception", SMD:"Delivery delayed",
    DNB:"Delivery next day", ONH:"On hold", NWI:"Courier network issue",
    RTO:"Returning to sender", RTD:"Returned to sender", CAN:"Courier shipment cancelled",
    LOST:"Shipment exception", "23":"Delivery attempted", "25":"Delivery attempted"
  }
  return {
    stage, code,
    label: stage === "exception" ? exceptionLabels[code] || details.label : details.label,
    description: details.description,
    lastLocation: firstWithLocation?.location || null,
    latestScanAt: firstWithTime?.occurredAt || null,
    scans,
    courierName: live?.courierName || null,
    trackUrl: live?.trackUrl || null,
    estimatedDeliveryDate: live?.estimatedDeliveryDate || null,
    checkedAt
  }
}

export const COURIER_MILESTONES = [
  { stage: "pickup_requested", label: "Pickup requested" },
  { stage: "picked_up", label: "Picked up" },
  { stage: "in_transit", label: "In transit" },
  { stage: "out_for_delivery", label: "Out for delivery" },
  { stage: "delivered", label: "Delivered" }
] as const

export function courierMilestoneIndex(stage: CourierStage): number {
  if (stage === "exception" || stage === "returning") return -1
  return COURIER_MILESTONES.findIndex(step => step.stage === stage)
}
