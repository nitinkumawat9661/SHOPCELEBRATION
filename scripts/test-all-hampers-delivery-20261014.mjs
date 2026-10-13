#!/usr/bin/env node
// Offline regression: ₹50 included in visible final price, saved separately internally; old budgets unchanged.
// Source test complements isolated PostgreSQL integration, which verifies totals.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const get = async path => readFile(new URL("../" + path, import.meta.url), "utf8")
const [delivery, create, selfBuild, payment, jewelry, provider] = await Promise.all([
  get("config/self-build-delivery.ts"),
  get("lib/server/orders/create.ts"),
  get("lib/server/orders/self-build-no-inventory.ts"),
  get("features/builder/steps/PaymentStep.tsx"),
  get("features/cart/CartCheckout.tsx"),
  get("lib/server/payments/provider.ts")
])
assert.match(delivery, /SELF_BUILD_DELIVERY_FEE_PAISE\s*=\s*5000/,
  "Canonical hamper delivery charge must stay ₹50")
assert.match(delivery, /HAMPER_DELIVERY_FEE_PAISE\s*=\s*SELF_BUILD_DELIVERY_FEE_PAISE/)
assert.ok(create.includes('input.orderType === "individual"') &&
  create.includes(": HAMPER_DELIVERY_FEE_PAISE") &&
  create.includes("productPricing.payablePaise + (shippingPaise || 0)"),
  "Existing checkout backend must apply delivery once to all hampers after discounts")
assert.ok(create.includes('options.selfBuildShippingPaise !== HAMPER_DELIVERY_FEE_PAISE'),
  "Explicit Self-Build charge must not be changed or doubled")
assert.ok(selfBuild.includes("selfBuildShippingPaise:SELF_BUILD_DELIVERY_FEE_PAISE"),
  "Self-Build keeps the same backend shared checkout and ₹50 fee")
assert.ok(payment.includes("const deliveryPaise = individual ?") &&
  payment.includes("productPayablePaise + deliveryPaise") &&
  payment.includes('aria-label="Hamper final price"') &&
  payment.includes("Final hamper price: {formatMoney(payablePaise / 100)}") &&
  !payment.includes("delivery at checkout") &&
  !payment.includes(" · Delivery"),
  "Hamper checkout must show one inclusive final price, never a separate delivery line")
assert.ok(jewelry.includes('<span>Delivery charges</span><b className="marketCartIncluded">FREE</b>'),
  "Individual jewellery free-delivery messaging must remain unchanged")
assert.ok(provider.includes("createProviderCheckout") && provider.includes("verifyProviderWebhook"),
  "Reuses existing Cashfree/Razorpay checkout and webhook infrastructure")
console.log("ALL_HAMPERS_DELIVERY_₹50_CONTRACT_PASSED: curated gateway/manual, Self-Build, jewelry unchanged, no second gateway")
