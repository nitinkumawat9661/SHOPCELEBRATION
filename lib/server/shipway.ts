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
  estimatedDeliveryDate: string | null
}

export type ShipwayRateQuote = {
  carrierId: string
  carrierName: string
  shippingPaise: number
  chargeRupees: number
  billedWeightKg: number | null
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

function objectList(value: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (!node || typeof node !== "object") return
    const record = node as Record<string, unknown>
    found.push(record)
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") visit(child)
    }
  }
  visit(value)
  return found
}

function positiveNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function normalizeDeliveryDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null
  const text = String(value).trim()
  if (!text) return null

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const candidate = `${iso[1]}-${iso[2]}-${iso[3]}`
    const parsed = new Date(`${candidate}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) ? candidate : null
  }

  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/)
  if (dmy) {
    const candidate = `${dmy[3]}-${dmy[2]}-${dmy[1]}`
    const parsed = new Date(`${candidate}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) ? candidate : null
  }

  const parsed = new Date(text)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null
}

function estimatedDeliveryDateFrom(raw: unknown) {
  const keys = [
    "expected_delivery_date",
    "expected_delivery",
    "estimated_delivery_date",
    "estimated_delivery",
    "edd",
    "edd_date",
    "promised_delivery_date",
    "promised_delivery"
  ]
  for (const row of objectList(raw)) {
    for (const key of keys) {
      if (!(key in row)) continue
      const normalized = normalizeDeliveryDate(row[key])
      if (normalized) return normalized
    }
  }
  return null
}

async function shipwayWarehousePincode(warehouseId: string) {
  const raw = await request(`/api/getwarehouses?warehouseid=${encodeURIComponent(warehouseId)}`, { method: "GET" })
  const warehouse = objectList(raw).find((item) => String(item.warehouse_id ?? item.id ?? "").trim() === warehouseId)
  const pincode = String(warehouse?.pincode ?? warehouse?.zipcode ?? "").trim()
  if (!/^\d{6}$/.test(pincode)) throw new ShipwayApiError("SHIPWAY_WAREHOUSE_NOT_FOUND")
  return pincode
}

function halfKgSlab(weightGrams: number) {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) return null
  const kg = weightGrams / 1000
  return Math.max(0.5, Math.ceil(kg * 2) / 2)
}

function rateOptions(raw: unknown) {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const direct = [
    ...(Array.isArray(root.rate_card) ? root.rate_card : []),
    ...(Array.isArray(root.data) ? root.data : []),
    ...(Array.isArray(root.rates) ? root.rates : [])
  ]
  const candidates = direct.length ? direct : objectList(raw)

  return candidates.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const carrierId = positiveNumber(row.carrier_id ?? row.courier_id ?? row.id)
    const charge = positiveNumber(row.delivery_charge ?? row.shipment_charges ?? row.shipping_charge ?? row.rate)
    if (!carrierId || !charge) return []
    const billedWeight = positiveNumber(row.charge_weight ?? row.billed_weight ?? row.weight)
    return [{
      carrierId: String(Math.trunc(carrierId)),
      charge,
      billedWeightKg: billedWeight,
      name: typeof row.courier_name === "string"
        ? row.courier_name.trim()
        : typeof row.courier === "string"
          ? row.courier.trim()
          : typeof row.name === "string" ? row.name.trim() : ""
    }]
  }).sort((a, b) => a.charge - b.charge || Number(a.carrierId) - Number(b.carrierId))
}

async function rateBasedCarrier(
  fromPincode: string,
  toPincode: string,
  input: { weightGrams?: number; lengthCm?: number; breadthCm?: number; heightCm?: number } = {}
) {
  const params = new URLSearchParams({
    fromPincode,
    toPincode,
    paymentType: "prepaid",
    shipment_type: "1"
  })
  const weightKg = typeof input.weightGrams === "number" ? halfKgSlab(input.weightGrams) : null
  if (weightKg) params.set("weight", String(weightKg))
  if (input.lengthCm && input.lengthCm > 0) params.set("length", String(Math.round(input.lengthCm)))
  if (input.breadthCm && input.breadthCm > 0) params.set("breadth", String(Math.round(input.breadthCm)))
  if (input.heightCm && input.heightCm > 0) params.set("height", String(Math.round(input.heightCm)))

  const raw = await request(`/api/getshipwaycarrierrates?${params.toString()}`, { method: "GET" })
  const options = rateOptions(raw)
  if (options.length) return options[0]

  const fallback = await request(
    `/api/pincodeserviceable?pincode=${encodeURIComponent(toPincode)}&payment_type=P`,
    { method: "GET" }
  )
  const serviceable = objectList(fallback).flatMap((row) => {
    const carrierId = positiveNumber(row.carrier_id ?? row.id)
    if (!carrierId) return []
    return [{
      carrierId: String(Math.trunc(carrierId)),
      charge: Number.POSITIVE_INFINITY,
      billedWeightKg: weightKg,
      name: typeof row.carrier_title === "string"
        ? row.carrier_title.trim()
        : typeof row.name === "string" ? row.name.trim() : ""
    }]
  }).sort((a, b) => Number(a.carrierId) - Number(b.carrierId))

  if (!serviceable.length) throw new ShipwayApiError("SHIPWAY_NO_SERVICEABLE_CARRIER")
  throw new ShipwayApiError("SHIPWAY_RATE_UNAVAILABLE")
}

export async function quoteShipwayShipping(input: {
  toPincode: string
  weightGrams?: number
  lengthCm?: number
  breadthCm?: number
  heightCm?: number
}): Promise<ShipwayRateQuote> {
  const toPincode = String(input.toPincode || "").trim()
  if (!/^\d{6}$/.test(toPincode)) throw new ShipwayApiError("INVALID_SHIPPING_PINCODE")
  const warehouseId = numericId(requireEnv("shipwayWarehouseId"), "INVALID_SHIPWAY_WAREHOUSE_ID")
  const pickupPincode = await shipwayWarehousePincode(warehouseId)
  const selected = await rateBasedCarrier(pickupPincode, toPincode, input)
  if (!Number.isFinite(selected.charge) || selected.charge <= 0) throw new ShipwayApiError("SHIPWAY_RATE_UNAVAILABLE")
  return {
    carrierId: selected.carrierId,
    carrierName: selected.name,
    shippingPaise: Math.round(selected.charge * 100),
    chargeRupees: selected.charge,
    billedWeightKg: selected.billedWeightKg
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

function packedWeight(order: OrderRecord, value: number) {
  if (!Number.isInteger(value)) throw new ShipwayApiError("INVALID_SHIPPING_WEIGHT")
  if (order.orderType === "individual") {
    if (value < 1 || value > 5000) throw new ShipwayApiError("INVALID_SHIPPING_WEIGHT")
    return value
  }
  if (value < 100 || value > 30000) throw new ShipwayApiError("INVALID_SHIPPING_WEIGHT")
  return value
}

function packedDimension(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 200) throw new ShipwayApiError("INVALID_SHIPPING_DIMENSIONS")
  return value
}

export async function bookShipwayShipment(order: OrderRecord, packed: {
  weightGrams: number
  lengthCm: number
  breadthCm: number
  heightCm: number
}): Promise<ShipwayBooking> {
  const warehouseId = numericId(requireEnv("shipwayWarehouseId"), "INVALID_SHIPWAY_WAREHOUSE_ID")
  const returnWarehouseId = numericId(requireEnv("shipwayReturnWarehouseId"), "INVALID_SHIPWAY_RETURN_WAREHOUSE_ID")
  const name = splitName(order.receiverName)
  const weightGrams = packedWeight(order, packed.weightGrams)
  const lengthCm = packedDimension(packed.lengthCm)
  const breadthCm = packedDimension(packed.breadthCm)
  const heightCm = packedDimension(packed.heightCm)
  const selectedCarrier = await quoteShipwayShipping({ toPincode: order.pincode, weightGrams, lengthCm, breadthCm, heightCm })

  console.info("shipway-carrier-selected", {
    orderId: order.publicId,
    carrierId: selectedCarrier.carrierId,
    carrier: selectedCarrier.carrierName,
    quotedCharge: selectedCarrier.chargeRupees,
    packedWeightGrams: weightGrams,
    box: { lengthCm, breadthCm, heightCm }
  })

  const payload = {
    order_id: order.publicId,
    carrier_id: Number(selectedCarrier.carrierId),
    warehouse_id: warehouseId,
    return_warehouse_id: returnWarehouseId,
    products: productsFor(order),
    payment_type: "P",
    discount: rupees(order.discountPaise),
    shipping: rupees(order.shippingPaise),
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
    order_weight: weightGrams,
    box_length: lengthCm,
    box_breadth: breadthCm,
    box_height: heightCm,
    ...(orderDate(order.createdAt) ? { order_date: orderDate(order.createdAt) } : {})
  }

  const raw = await request("/api/v2orders", { method: "POST", body: JSON.stringify(payload) })
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const awbRaw = root.awb_response
  const awbResponse = awbRaw && typeof awbRaw === "object" ? awbRaw as Record<string, unknown> : {}
  const awb = String(awbResponse.AWB ?? "").trim()
  const carrierId = String(awbResponse.carrier_id ?? "").trim()
  if (!awb) {
    console.error("shipway-booking-response", {
      orderId: order.publicId,
      success: root.success ?? null,
      message: typeof root.message === "string" ? root.message.slice(0, 300) : null,
      error: typeof root.error === "string" || typeof root.error === "number" || typeof root.error === "boolean" ? root.error : null,
      awbSuccess: awbResponse.success ?? null,
      awbMessage: typeof awbResponse.message === "string" ? awbResponse.message.slice(0, 300) : null,
      awbError: typeof awbResponse.error === "string" || typeof awbResponse.error === "number" || typeof awbResponse.error === "boolean" ? awbResponse.error : null
    })
    throw new ShipwayApiError("SHIPWAY_AWB_NOT_ASSIGNED")
  }
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
  let estimatedDeliveryDate = estimatedDeliveryDateFrom(raw)
  if (!estimatedDeliveryDate) {
    try {
      const orderRaw = await request(`/api/getorders?awb_number=${encodeURIComponent(awb)}`, { method: "GET" })
      estimatedDeliveryDate = estimatedDeliveryDateFrom(orderRaw)
    } catch (error) {
      console.warn("shipway-edd-fallback", error instanceof Error ? error.message : "unknown")
    }
  }
  return {
    shipmentStatus,
    currentStatus: String(current.current_status ?? "").trim(),
    courierName: typeof current.courier_name === "string" && current.courier_name.trim() ? current.courier_name.trim() : null,
    trackUrl: httpsUrl(tracking.track_url),
    estimatedDeliveryDate
  }
}


function shipwayCancelAccepted(raw: unknown) {
  const rows = objectList(raw)
  const values = rows.flatMap((row) => [
    row.success,
    row.status,
    row.message,
    row.msg
  ]).filter((value) => value !== undefined && value !== null)
  return values.some((value) => {
    if (value === true || value === 1 || value === "1") return true
    const text = String(value).trim().toLowerCase()
    return text === "success" || text.includes("cancelled successfully") || text.includes("canceled successfully") || text.includes("cancel successfully")
  })
}

export async function cancelShipwayShipment(awb: string) {
  if (!/^[A-Za-z0-9._-]{4,120}$/.test(awb)) throw new ShipwayApiError("INVALID_SHIPWAY_AWB")
  const raw = await request("/api/Cancel/", {
    method: "POST",
    body: JSON.stringify({ awb_number: awb })
  })
  if (!shipwayCancelAccepted(raw)) {
    console.error("shipway-cancel-response", { awb, responseType: Array.isArray(raw) ? "array" : typeof raw })
    throw new ShipwayApiError("SHIPWAY_CANCEL_FAILED")
  }
  return { ok: true as const }
}
