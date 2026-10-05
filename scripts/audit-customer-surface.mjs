import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const customerFiles = [
  "content/store.json",
  "content/errors.json",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/policies/page.tsx",
  "app/compliance/page.tsx",
  "features/shell/SiteFooter.tsx",
  "features/account/CustomerAccountPage.tsx",
  "features/account/CustomerAuthPanel.tsx",
  "features/tracking/TrackingPage.tsx",
  "features/tracking/PackingApprovalCard.tsx",
  "features/builder/steps/PaymentStep.tsx",
  "features/checkout/PaymentReturnStatus.tsx",
  "features/home/CustomRequestSection.tsx"
]

const forbidden = [
  "Gateway payments",
  "payment provider/server",
  "UPI UTR",
  "No UTR",
  "bank/provider",
  "kept server-side",
  "MSG91 couldn’t",
  "OTP verification failed (",
  "Shipway assigns",
  "retrying automatically",
  "server-side price validation",
  "provider-side verification",
  "payment-gateway fee",
  "Cashfree Payments",
  "Cashfree refund",
  "Internal code/UI",
  "Dark-Pattern Self-Audit",
  "server-validated catalog",
  "SaaS billing",
  "Rogue malware",
  "data-payment-provider",
  "session identifier",
  "checkout funnel"
]

for (const file of customerFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
  for (const phrase of forbidden) {
    assert(!source.includes(phrase), `${file} exposes customer-facing implementation wording: ${phrase}`)
  }
}

const accountOrders = await readFile(new URL("../app/api/account/orders/route.ts", import.meta.url), "utf8")
assert(!accountOrders.includes("...order,"), "Customer order API must allow-list response fields instead of spreading the internal order object")
assert(!accountOrders.includes("shippingProvider: order.shippingProvider"), "Customer order API must not expose the internal shipping provider")

const tracking = await readFile(new URL("../app/api/track/route.ts", import.meta.url), "utf8")
assert(!tracking.includes("shippingProvider: order.shippingProvider"), "Tracking API must not expose the internal shipping provider")
assert(!tracking.includes("shippingLiveStatus,"), "Tracking API must not expose raw courier status fields")
assert(!tracking.includes("shippingTrackUrl,"), "Tracking API must not expose aggregator tracking URLs")

console.log("Customer-surface audit passed: no known implementation/vendor copy leaks and public order payloads are allow-listed.")
