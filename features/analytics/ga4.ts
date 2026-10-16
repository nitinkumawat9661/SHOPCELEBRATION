"use client"

import { publicEnv } from "../../config/public-env"

export type Ga4Item = {
  item_id: string
  item_name: string
  item_brand?: string
  item_category?: string
  price?: number
  quantity?: number
  discount?: number
}

export type Ga4Purchase = {
  transaction_id: string
  value: number
  currency: "INR"
  shipping?: number
  items: Ga4Item[]
}

type GaWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

const PURCHASE_KEY_PREFIX = "celebration:ga4:purchase:"
const PAYMENT_INFO_KEY_PREFIX = "celebration:ga4:payment-info:"

function measurementReady() {
  return /^G-[A-Z0-9]+$/i.test(publicEnv.ga4MeasurementId)
}

function ensureGtag() {
  if (typeof window === "undefined" || !measurementReady()) return null
  const target = window as GaWindow
  target.dataLayer = target.dataLayer || []
  if (!target.gtag) {
    target.gtag = function (...args: unknown[]) {
      target.dataLayer!.push(args)
    }
  }
  return target.gtag
}

function send(eventName: string, params: Record<string, unknown>) {
  const gtag = ensureGtag()
  if (!gtag) return false
  gtag("event", eventName, params)
  return true
}

export function trackGa4ViewItem(item: Ga4Item) {
  const price = typeof item.price === "number" ? item.price : 0
  send("view_item", {
    currency: "INR",
    value: price * (item.quantity || 1),
    items: [{ ...item, item_brand: item.item_brand || "Celebration" }]
  })
}

export function trackGa4AddToCart(item: Ga4Item) {
  const price = typeof item.price === "number" ? item.price : 0
  const quantity = item.quantity || 1
  send("add_to_cart", {
    currency: "INR",
    value: price * quantity,
    items: [{ ...item, quantity, item_brand: item.item_brand || "Celebration" }]
  })
}

export function trackGa4RemoveFromCart(item: Ga4Item) {
  const quantity = item.quantity || 1
  const price = typeof item.price === "number" ? item.price : 0
  send("remove_from_cart", {
    currency: "INR",
    value: price * quantity,
    items: [{ ...item, quantity, item_brand: item.item_brand || "Celebration" }]
  })
}

export function trackGa4BeginCheckout(items: Ga4Item[], value: number) {
  if (!items.length || !Number.isFinite(value) || value < 0) return
  send("begin_checkout", {
    currency: "INR",
    value,
    items: items.map((item) => ({ ...item, item_brand: item.item_brand || "Celebration" }))
  })
}

export function trackGa4AddShippingInfo(items: Ga4Item[], value: number) {
  if (!items.length || !Number.isFinite(value) || value < 0) return
  send("add_shipping_info", {
    currency: "INR",
    value,
    shipping_tier: "Standard delivery",
    items: items.map((item) => ({ ...item, item_brand: item.item_brand || "Celebration" }))
  })
}

// Only report when the server has created a real payment checkout. A retry of
// the same order should not inflate the payment-step conversion count.
export function trackGa4AddPaymentInfo(purchase: Ga4Purchase | null | undefined, provider: "razorpay" | "cashfree") {
  if (!purchase?.transaction_id || !purchase.items?.length || !Number.isFinite(purchase.value) || purchase.value < 0) return false
  if (!measurementReady() || typeof window === "undefined") return false
  const key = `${PAYMENT_INFO_KEY_PREFIX}${purchase.transaction_id}`
  try {
    if (window.sessionStorage.getItem(key) === "sent") return false
  } catch {
    // Tracking must not interfere with checkout if browser storage is disabled.
  }
  const sent = send("add_payment_info", {
    currency: purchase.currency,
    value: purchase.value,
    payment_type: provider,
    items: purchase.items.map((item) => ({ ...item, item_brand: item.item_brand || "Celebration" }))
  })
  if (sent) {
    try { window.sessionStorage.setItem(key, "sent") } catch { /* Non-critical dedupe layer. */ }
  }
  return sent
}

export function trackGa4Purchase(purchase: Ga4Purchase | null | undefined) {
  if (!purchase?.transaction_id || !purchase.items?.length || !Number.isFinite(purchase.value) || purchase.value < 0) return false
  if (!measurementReady() || typeof window === "undefined") return false

  const key = `${PURCHASE_KEY_PREFIX}${purchase.transaction_id}`
  try {
    if (window.localStorage.getItem(key) === "sent") return false
  } catch {
    // Local storage is only an extra client-side dedupe layer.
  }

  const sent = send("purchase", {
    transaction_id: purchase.transaction_id,
    value: purchase.value,
    currency: purchase.currency,
    shipping: purchase.shipping || 0,
    items: purchase.items.map((item) => ({ ...item, item_brand: item.item_brand || "Celebration" }))
  })
  if (!sent) return false

  try {
    window.localStorage.setItem(key, "sent")
  } catch {
    // GA4 also deduplicates purchases using transaction_id.
  }
  return true
}
