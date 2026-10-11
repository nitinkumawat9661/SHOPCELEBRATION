/** Normalization of Shipway forward-shipment tracking.
 *
 * The API may return an array of {awb, tracking_details:{...}}, a wrapped
 * "response", or order-list rows. Do NOT mistake shipment_details (order
 * metadata such as "Exchange") for tracking-history scans.
 */
export type CarrierScan = { status: string; location: string | null; occurredAt: string | null; details: string | null }
export type CarrierResponse = {
  shipmentStatus: string
  currentStatus: string
  courierName: string | null
  trackUrl: string | null
  estimatedDeliveryDate: string | null
  scans: CarrierScan[]
}

type Row = Record<string, unknown>
const asRow = (value: unknown): Row | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Row : null
const clean = (value: unknown, limit = 160): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit)
    : ""
const awbFrom = (row: Row): string => {
  const wrapped = asRow(row.awb_response)
  return clean(row.awb ?? row.AWB ?? row.awb_number ?? row.order_tracking_number ?? row.tracking_number ?? row.waybill ?? wrapped?.AWB, 120)
}

const statusAliases: Record<string,string> = {
  "ORDER PLACED":"SCH","DATA RECEIVED":"SCH","PICKUP REQUESTED":"SCH",
  "PICKUP SCHEDULED":"SCH","SHIPMENT BOOKED":"SCH","OUT FOR PICKUP":"OFP",
  "PICKED":"PKP","PICKED UP":"PKP","PICKUP DONE":"PKP","PICKUP COMPLETE":"PKP",
  "IN TRANSIT":"INT","SHIPPED":"INT","OUT FOR DELIVERY":"OOD",
  "ARRIVING TODAY":"OOD","DELIVERED":"DEL","PICKUP NOT DONE":"PKF",
  "PICKUP FAILED":"PKF","PICKUP CANCELLED":"PCAN",
  "DELIVERY ATTEMPTED":"UND","UNDELIVERED":"UND",
  "RTO":"RTO","RETURN TO ORIGIN":"RTO","RETURNING TO SENDER":"RTO",
  "RTO DELIVERED":"RTD","CANCELLED":"CAN","ON HOLD":"ONH"
}
const known = new Set([
  "SCH","OFP","NFI","NFIDS","PKP","INT","OOD","OFD","DEL","UND",
  "RTO","RTD","CAN","ONH","NWI","DNB","ODA","OTH","SMD","CRTA",
  "CNA","DEX","DRE","PNR","LOST","PKF","PCAN","FDR"
])
export function normalizeShipwayStatus(value: unknown): string {
  const name = clean(value, 120).toUpperCase().replace(/[_-]/g," ").replace(/\s+/g," ")
  if (known.has(name)) return name
  if (statusAliases[name]) return statusAliases[name]
  // Only a narrow, specific current_status phrase is recognized. Generic
  // "Exchange" / "Processing" / "Manifested" is NOT delivery evidence.
  if (/^OUT FOR DELIVERY(?:\b|$)/.test(name)) return "OOD"
  if (/^DELIVERED(?:\b|$)/.test(name)) return "DEL"
  if (/^PICKED UP(?:\b|$)/.test(name)) return "PKP"
  if (/^IN TRANSIT(?:\b|$)/.test(name)) return "INT"
  return ""
}
const forwardProgress = (code: string): number =>
  code === "DEL" ? 5 : code === "OOD" || code === "OFD" ? 4 :
  code === "INT" ? 3 : code === "PKP" ? 2 :
  code === "OFP" ? 1 : code === "SCH" ? 0 : -1

export function promotedShipwayStatus(a: string, b: string): string {
  const first = normalizeShipwayStatus(a)
  const second = normalizeShipwayStatus(b)
  if (forwardProgress(first) < 0) return second || first
  return forwardProgress(second) > forwardProgress(first) ? second : first
}

const scanHistory = (value: unknown): CarrierScan[] => {
  if (!Array.isArray(value)) return []
  return value.slice(0, 60).flatMap((entry): CarrierScan[] => {
    const row = asRow(entry)
    if (!row) return []
    const original = clean(row.status ?? row.current_status ?? row.status_detail ?? row.description, 105)
    const code = normalizeShipwayStatus(row.current_status_code ?? row.status_code ?? row.code ?? original)
    // Exchange is order/return metadata, NOT a scanned forward-shipment step.
    // An unknown status is still displayed if it is a real dated scan.
    const timestamp = clean(row.timestamp ?? row.status_date ?? row.time ?? row.date, 55) || null
    if (!code && !timestamp) return []
    const location = clean(row.location ?? row.current_location ?? row.city ?? row.hub, 85) || null
    const details = clean(row.remarks ?? row.status_detail ?? row.description, 150)
    return [{ status: original || code, location, occurredAt: timestamp,
      details: details && details !== original ? details : null }]
  })
}
const rowsOf = (raw: unknown): Row[] => {
  if (Array.isArray(raw)) return raw.filter((x): x is Row => Boolean(asRow(x)))
  const root = asRow(raw)
  if (!root) return []
  for (const key of ["orders","data","response","results","message"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).filter((x): x is Row => Boolean(asRow(x)))
  }
  return [root]
}

export function parseShipwayTrackingResponse(raw: unknown, expectedAwb: string): CarrierResponse | null {
  const records = rowsOf(raw)
  if (!records.length) return null
  const explicitlyIdentified = records.filter(row => awbFrom(row))
  const item = explicitlyIdentified.length
    ? explicitlyIdentified.find(row => awbFrom(row) === expectedAwb)
    : records.length === 1 ? records[0] : undefined
  if (!item) return null // fail closed on a different AWB or ambiguous array
  const payload = asRow(item.tracking_details) || asRow(item.response) || asRow(item.data) || item
  const shipment = Array.isArray(payload.shipment_details)
    ? asRow(payload.shipment_details[0]) || {} : {}
  const scans = scanHistory(payload.tracking_history ?? payload.shipment_history ?? payload.scan)
  let code = normalizeShipwayStatus(payload.shipment_status ?? payload.new_shipment_status ??
    payload.current_status_code ?? item.shipment_status ?? item.new_shipment_status ?? item.current_status_code)
  // Shipway can return a stale SCH code alongside newer, dated courier scans.
  // Never promote on a fake "Exchange" metadata row or undated text.
  const latest = [...scans].filter(scan => scan.occurredAt)
    .sort((a,b) => Date.parse(String(b.occurredAt).replace(" ","T")) - Date.parse(String(a.occurredAt).replace(" ","T")))[0]
  if (latest) code = promotedShipwayStatus(code, normalizeShipwayStatus(latest.status))
  code = promotedShipwayStatus(code,normalizeShipwayStatus(payload.new_shipment_status ?? shipment.new_shipment_status))
  if (!code) code = normalizeShipwayStatus(shipment.current_status ?? payload.current_status)
  const currentStatus = clean(shipment.current_status ?? payload.current_status, 120)
  const courierName = clean(shipment.courier_name ?? payload.courier_name ?? payload.carrier, 90) || null
  const url = clean(payload.track_url ?? item.track_url, 500)
  const trackUrl = url.startsWith("https://") ? url : null
  return { shipmentStatus: code, currentStatus, courierName, trackUrl,
    estimatedDeliveryDate: null, scans }
}

export function parseShipwayOrderByAwb(raw: unknown, expectedAwb: string): Partial<CarrierResponse> | null {
  const matches: Row[] = []
  const visited = new Set<unknown>()
  function visit(value: unknown, depth: number) {
    if (depth > 5 || !value || visited.has(value)) return
    visited.add(value)
    if (Array.isArray(value)) { for (const element of value) visit(element,depth+1); return }
    const row = asRow(value)
    if (!row) return
    if (awbFrom(row) === expectedAwb) matches.push(row)
    for (const [key,child] of Object.entries(row)) {
      if (!["products","line_items","address","customer","billing","shipping_address"].includes(key)
          && child && typeof child === "object") visit(child,depth+1)
    }
  }
  visit(raw,0)
  if (!matches.length) return null
  // Only status fields for the EXACT AWB are trusted. Order status E/A/G and
  // "Exchange" do not represent physical courier movement.
  let status = ""
  for (const row of matches) {
    status = promotedShipwayStatus(status,normalizeShipwayStatus(
      row.new_shipment_status ?? row.shipment_status ?? row.shipment_status_code ?? row.current_status_code ?? row.tracking_status))
  }
  const record = matches.find(row => normalizeShipwayStatus(
    row.new_shipment_status ?? row.shipment_status ?? row.shipment_status_code ?? row.current_status_code ?? row.tracking_status)) || matches[0]
  return {
    shipmentStatus: status,
    currentStatus: clean(record.current_status ?? record.shipment_status,120),
    courierName: clean(record.courier_name ?? record.carrier_name,90) || null
  }
}
