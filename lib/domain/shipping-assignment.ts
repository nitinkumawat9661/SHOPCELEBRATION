import { shippingConfig } from "../../config/shipping"

export type ShippingCoordinate = {
  latitude: number
  longitude: number
}

export type ShippingRateQuote = {
  provider: string
  carrierId: string | number
  serviceName?: string
  totalPaise: number
  serviceable?: boolean
  estimatedDeliveryDays?: number | null
}

export type ShippingAssignmentReason =
  | "LOCAL_RADIUS"
  | "DISTANCE_UNKNOWN"
  | "NO_SERVICEABLE_RATE"
  | "CHEAPEST_SERVICEABLE"

export type ShippingAssignmentDecision =
  | {
      mode: "manual"
      reason: Exclude<ShippingAssignmentReason, "CHEAPEST_SERVICEABLE">
      distanceKm: number | null
      selectedQuote: null
    }
  | {
      mode: "auto"
      reason: "CHEAPEST_SERVICEABLE"
      distanceKm: number
      selectedQuote: ShippingRateQuote
    }

const EARTH_RADIUS_KM = 6371.0088

function validCoordinate(value: ShippingCoordinate | null | undefined): value is ShippingCoordinate {
  return Boolean(
    value &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  )
}

function radians(value: number) {
  return value * Math.PI / 180
}

export function shippingDistanceKm(origin: ShippingCoordinate | null | undefined, destination: ShippingCoordinate | null | undefined) {
  if (!validCoordinate(origin) || !validCoordinate(destination)) return null

  const lat1 = radians(origin.latitude)
  const lat2 = radians(destination.latitude)
  const deltaLat = radians(destination.latitude - origin.latitude)
  const deltaLon = radians(destination.longitude - origin.longitude)
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  const bounded = Math.min(1, Math.max(0, a))
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded))
}

function quoteIsEligible(quote: ShippingRateQuote) {
  return quote.serviceable !== false &&
    typeof quote.provider === "string" && quote.provider.trim().length > 0 &&
    (typeof quote.carrierId === "string" || typeof quote.carrierId === "number") &&
    Number.isSafeInteger(quote.totalPaise) && quote.totalPaise > 0
}

function deliveryDays(quote: ShippingRateQuote) {
  const value = quote.estimatedDeliveryDays
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
}

export function cheapestServiceableQuote(quotes: ShippingRateQuote[]) {
  const eligible = quotes.filter(quoteIsEligible)
  eligible.sort((a, b) => {
    if (a.totalPaise !== b.totalPaise) return a.totalPaise - b.totalPaise
    const etaDifference = deliveryDays(a) - deliveryDays(b)
    if (Number.isFinite(etaDifference) && etaDifference !== 0) return etaDifference
    const providerDifference = a.provider.localeCompare(b.provider)
    if (providerDifference !== 0) return providerDifference
    return String(a.carrierId).localeCompare(String(b.carrierId))
  })
  return eligible[0] || null
}

export function decideShippingAssignment(input: {
  origin: ShippingCoordinate | null | undefined
  destination: ShippingCoordinate | null | undefined
  quotes: ShippingRateQuote[]
  manualRadiusKm?: number
}): ShippingAssignmentDecision {
  const manualRadiusKm = input.manualRadiusKm ?? shippingConfig.manualRadiusKm
  if (!Number.isFinite(manualRadiusKm) || manualRadiusKm < 0) throw new Error("INVALID_MANUAL_RADIUS")

  const distanceKm = shippingDistanceKm(input.origin, input.destination)
  if (distanceKm === null) {
    return { mode: "manual", reason: "DISTANCE_UNKNOWN", distanceKm: null, selectedQuote: null }
  }

  if (distanceKm <= manualRadiusKm) {
    return { mode: "manual", reason: "LOCAL_RADIUS", distanceKm, selectedQuote: null }
  }

  const selectedQuote = cheapestServiceableQuote(input.quotes)
  if (!selectedQuote) {
    return { mode: "manual", reason: "NO_SERVICEABLE_RATE", distanceKm, selectedQuote: null }
  }

  return { mode: "auto", reason: "CHEAPEST_SERVICEABLE", distanceKm, selectedQuote }
}
