"use client"

import { routes } from "../../config/routes"

export type ClientConversionEvent =
  | "storefront_view"
  | "budget_selected"
  | "builder_started"
  | "checkout_reached"
  | "offer_shown"
  | "payment_started"

const SESSION_KEY = "celebration:conversion-session:v1"

function conversionSessionId() {
  if (typeof window === "undefined") return ""
  try {
    const current = window.sessionStorage.getItem(SESSION_KEY)
    if (current) return current
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function trackConversion(eventName: ClientConversionEvent, data: { tierId?: string; campaignId?: string } = {}) {
  if (typeof window === "undefined") return
  const sessionId = conversionSessionId()
  void fetch(routes.api.analyticsEvent, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, eventName, ...data }),
    keepalive: true
  }).catch(() => undefined)
}
