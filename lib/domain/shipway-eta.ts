/** Parse only explicit date/transit fields on the selected carrier's quote.
 * Shipway's usual rate response contains cost and zone but no ETA.
 * Never manufacture a calendar date by adding days to today: dispatch is unknown.
 */
export type CarrierRateEstimate = {
  estimatedDeliveryDate: string | null
  estimatedTransitDays: number | null
}

export function carrierEstimateFromRate(row: Record<string, unknown>, now = new Date()): CarrierRateEstimate {
  const dateFields = ["estimated_delivery_date", "expected_delivery_date", "edd_date"]
  const daysFields = ["estimated_delivery_days", "delivery_days", "edd_days", "transit_days"]

  let estimatedDeliveryDate: string | null = null
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (const key of dateFields) {
    const raw = row[key]
    if (typeof raw !== "string") continue
    const candidate = raw.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T|\s|$)/)?.[1]
    if (!candidate) continue
    const parsed = new Date(`${candidate}T00:00:00.000Z`)
    const daysAway = (parsed.getTime() - utcToday) / 86_400_000
    if (!Number.isFinite(daysAway) || parsed.toISOString().slice(0, 10) !== candidate || daysAway < 0 || daysAway > 60) continue
    estimatedDeliveryDate = candidate
    break
  }

  let estimatedTransitDays: number | null = null
  for (const key of daysFields) {
    const raw = row[key]
    if (typeof raw !== "number" && typeof raw !== "string") continue
    if (typeof raw === "string" && !/^\d+$/.test(raw.trim())) continue
    const value = Number(raw)
    if (Number.isInteger(value) && value >= 1 && value <= 30) {
      estimatedTransitDays = value
      break
    }
  }
  return { estimatedDeliveryDate, estimatedTransitDays }
}
