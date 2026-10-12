import { createHash } from "node:crypto"
import type { ShipwayTracking } from "../shipway"
import { displayCourierStatus } from "../../domain/courier-tracking"
import type { OrderStatus } from "../../domain/order-status"
import { transaction } from "../db"
import { appendOrderEvent } from "./events"

const TRACKING_CODES = new Set([
  "SCH", "OFP", "NFI", "NFIDS", "PKP", "INT", "OOD", "OFD", "DEL",
  "UND", "ONH", "NWI", "DNB", "ODA", "OTH", "SMD", "CRTA",
  "CNA", "DEX", "DRE", "PNR", "LOST", "PKF", "PCAN", "FDR",
  "22", "23", "24", "25", "CAN", "RTO", "RTD"
])

/**
 * Observe real, authenticated Shipway statuses. Never advances order state,
 * books a shipment, cancels, or changes payment. Failures are caught by caller.
 */
export async function recordCourierObservation(
  publicId: string,
  awb: string,
  live: ShipwayTracking,
  orderStatus: OrderStatus
) {
  const code = live.shipmentStatus.trim().toUpperCase()
  if (!TRACKING_CODES.has(code) || !awb || orderStatus === "cancelled") return false

  const courier = displayCourierStatus(live, orderStatus, awb)
  if (!courier) return false
  const scan = live.scans.find(item => Boolean(item.occurredAt))
  const rawTime = scan?.occurredAt || ""
  const fingerprint = createHash("sha256")
    .update([awb, code, rawTime, scan?.status || ""].join("|"))
    .digest("hex")

  return transaction(async client => {
    const found = await client.query<{ id: string }>(
      `SELECT id FROM orders
        WHERE public_id=$1 AND shipping_tracking_number=$2
          AND lower(shipping_provider)='shipway' AND status <> 'cancelled'
        LIMIT 1`,
      [publicId, awb]
    )
    if (!found.rows[0]) return false
    const orderId = found.rows[0].id
    const inserted = await client.query(
      `INSERT INTO order_courier_observations
        (order_id,fingerprint,provider,code,stage,label,location,scan_occurred_at)
        VALUES ($1,$2,'Shipway',$3,$4,$5,$6,$7)
        ON CONFLICT (order_id,fingerprint) DO NOTHING RETURNING id`,
      [orderId, fingerprint, code, courier.stage, courier.label, courier.lastLocation, rawTime || null]
    )
    if (!inserted.rowCount) return false
    await appendOrderEvent(client, orderId, "courier_observed", {
      code,
      stage: courier.stage,
      label: courier.label,
      lastLocation: courier.lastLocation,
      scanOccurredAt: rawTime || null,
      awb,
      source: "verified_shipway_tracking"
    })
    return true
  })
}
