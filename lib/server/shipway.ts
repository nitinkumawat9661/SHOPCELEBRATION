import { requireEnv } from "../../config/env"
import type { OrderRecord } from "./orders/types"

const SHIPWAY_BASE = "https://app.shipway.com"

export class ShipwayApiError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

export type ShipwayBooking = {
  awb: string
  carrierId: string
  labelUrl: string | null
}

export type ShipwayTracking = {
  shipmentStatus: string
  currentStatus: string
  courierName: string | null
  trackUrl: string | null
}

function authHeader() {
  const email = requireEnv("shipwayEmail")
  const key = requireEnv("shipwayLicenseKey")
  return `Basic ${Buffer.from(`${email}:${key}`, "utf8").toString("base64")}`
}

function numericId(value: string, code: string) {
  if (!/^\d+$/.test(value) || Number(value) <= 0) throw new ShipwayApiError(code)
  return value
}

function rupees(paise: number) {
  return (paise / 100).toFixed(2)
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] || "Customer", last: parts.slice(1).join(" ") }
}

function orderDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 19).replace("T", " ") : undefined
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" ? parsed.toString() : null
  } catch {
    return null
  }
}

async function request(path: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(`${SHIPWAY_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      cache: "no-store"
    })
    const text = await response.text()
    let payload: unknown = null
    try { payload = text ? JSON.parse(text) : null } catch { payload = null }
    if (!response.ok) throw new ShipwayApiError(`SHIPWAY_HTTP_${response.status}`)
    return payload
  } catch (error) {
    if (error instanceof ShipwayApiError) throw error
    if (error instanceof Error && error.name === "AbortError") throw new ShipwayApiError("SHIPWAY_TIMEOUT")
    throw new ShipwayApiError("SHIPWAY_UNAVAILABLE")
  } finally {
    clearTimeout(timeout)
  }
}

function productsFor(order: OrderRecord) {
  if (order.orderType === "individual" && order.lineItems.length) {
    return order.lineItems.map((item) => ({
      product: item.name.slice(0, 100),
      price: rupees(item.unitPricePaise),
      product_code: item.productId.slice(0, 80),
      product_quantity: String(item.quantity),
      discount: "0",
      tax_rate: "0",
      tax_title: "IGST"
    }))
  }
  return [{
    product: `Celebration ${order.tierName} Hamper`.slice(0, 100),
    price: rupees(order.amountPaise),
    product_code: "CELEBRATION-HAMPER",
    product_quantity: "1",
    discount: "0",
    tax_rate: "0",
    tax_title: "IGST"
  }]
}

export async function bookShipwayShipment(order: OrderRecord): Promise<ShipwayBooking> {
  const warehouseId = numericId(requireEnv("shipwayWarehouseId"), "INVALID_SHIPWAY_WAREHOUSE_ID")
  const returnWarehouseId = numericId(requireEnv("shipwayReturnWarehouseId"), "INVALID_SHIPWAY_RETURN_WAREHOUSE_ID")
  const name = splitName(order.receiverName)

  const payload = {
    order_id: order.publicId,
    warehouse_id: warehouseId,
    return_warehouse_id: returnWarehouseId,
    products: productsFor(order),
    payment_type: "P",
    discount: rupees(order.discountPaise),
    shipping: "0",
    order_total: rupees(order.amountPaise),
    billing_address: order.address,
    billing_city: order.city,
    billing_state: order.state,
    billing_country: "India",
    billing_firstname: name.first,
    ...(name.last ? { billing_lastname: name.last } : {}),
    billing_phone: order.phone,
    billing_zipcode: order.pincode,
    shipping_address: order.address,
    shipping_city: order.city,
    shipping_state: order.state,
    shipping_country: "India",
    shipping_firstname: name.first,
    ...(name.last ? { shipping_lastname: name.last } : {}),
    shipping_phone: order.phone,
    shipping_zipcode: order.pincode,
    ...(orderDate(order.createdAt) ? { order_date: orderDate(order.createdAt) } : {})
  }

  const raw = await request("/api/v2orders", { method: "POST", body: JSON.stringify(payload) })
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const awbRaw = root.awb_response
  const awbResponse = awbRaw && typeof awbRaw === "object" ? awbRaw as Record<string, unknown> : {}
  const awb = String(awbResponse.AWB ?? "").trim()
  const carrierId = String(awbResponse.carrier_id ?? "").trim()
  if (!awb) throw new ShipwayApiError("SHIPWAY_AWB_NOT_ASSIGNED")
  return { awb, carrierId, labelUrl: httpsUrl(awbResponse.shipping_url) }
}

export async function getShipwayTracking(awb: string): Promise<ShipwayTracking | null> {
  if (!/^[A-Za-z0-9._-]{4,120}$/.test(awb)) return null
  const raw = await request(`/api/tracking?awb_numbers=${encodeURIComponent(awb)}&tracking_history=0`, { method: "GET" })
  if (!Array.isArray(raw) || !raw.length) return null
  const first = raw[0] && typeof raw[0] === "object" ? raw[0] as Record<string, unknown> : {}
  const trackingRaw = first.tracking_details
  const tracking = trackingRaw && typeof trackingRaw === "object" ? trackingRaw as Record<string, unknown> : {}
  const shipmentStatus = String(tracking.shipment_status ?? "").trim().toUpperCase()
  const details = Array.isArray(tracking.shipment_details) ? tracking.shipment_details : []
  const current = details[0] && typeof details[0] === "object" ? details[0] as Record<string, unknown> : {}
  return {
    shipmentStatus,
    currentStatus: String(current.current_status ?? "").trim(),
    courierName: typeof current.courier_name === "string" && current.courier_name.trim() ? current.courier_name.trim() : null,
    trackUrl: httpsUrl(tracking.track_url)
  }
}
