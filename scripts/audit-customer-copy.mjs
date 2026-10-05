import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const customerFiles = [
  "content/store.json",
  "features/account/CustomerAuthPanel.tsx",
  "features/builder/steps/PaymentStep.tsx",
  "features/checkout/PaymentReturnStatus.tsx",
  "features/home/ProofAndReviews.tsx",
  "features/tracking/TrackingPage.tsx",
  "features/tracking/TrackingLookup.tsx",
  "features/tracking/PackingApprovalCard.tsx"
]

const bannedVisiblePhrases = [
  /\bserver-side\b/i,
  /\bprovider confirmation\b/i,
  /\breset session\b/i,
  /\bsecure handoff\b/i,
  /\blogged-in sessions\b/i,
  /\btransaction reference\b/i,
  /\bpayment reference\b/i,
  /\bai[- ]generated\b/i,
  /\bartificial intelligence\b/i,
  /\bchatgpt\b/i
]

for (const file of customerFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
  for (const pattern of bannedVisiblePhrases) {
    assert(!pattern.test(source), `${file} contains customer-facing technical/AI wording: ${pattern}`)
  }
}

const ui = JSON.parse(await readFile(new URL("../content/ui.json", import.meta.url), "utf8"))
function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out)
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) if (key !== "admin") collectStrings(item, out)
  return out
}
for (const text of collectStrings(ui)) {
  for (const pattern of bannedVisiblePhrases) {
    assert(!pattern.test(text), `content/ui.json contains customer-facing technical/AI wording: "${text}"`)
  }
}

const trackingSources = await Promise.all([
  "app/api/orders/route.ts",
  "app/api/payments/create/route.ts",
  "app/api/payments/retry/route.ts",
  "app/api/payments/status/route.ts",
  "app/api/payments/verify/route.ts",
  "app/api/payments/return-status/route.ts",
  "app/api/track/lookup/route.ts"
].map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")))
for (const source of trackingSources) {
  assert(!source.includes("#token="), "New customer tracking links must not expose a #token label")
  assert(!source.includes("?token="), "New customer tracking links must not expose a ?token label")
}

const providerSource = await readFile(new URL("../lib/server/payments/provider.ts", import.meta.url), "utf8")
assert(!providerSource.includes("provider_order_id={order_id}"), "Payment return URL must not expose provider_order_id")
assert(providerSource.includes("/payment/return?payment={order_id}"), "Payment return URL should use the customer-friendly payment parameter")

console.log("Customer copy audit passed: no AI/dev-style wording or implementation-style customer URLs.")
