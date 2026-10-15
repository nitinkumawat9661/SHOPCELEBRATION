#!/usr/bin/env node
// Pre-release curated flow guard: remove size only from buyer-facing curated UI.
// Preserve tier.size as real catalog/operational data, and keep existing homepage builder unchanged.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (file) => readFile(new URL("../" + file, import.meta.url), "utf8")
const [flow, builder, details, payment, route, styles, globals, packageRaw, delivery] = await Promise.all([
  "features/builder/CuratedHamperFlow.tsx",
  "features/builder/HamperBuilder.tsx",
  "features/builder/steps/DetailsStep.tsx",
  "features/builder/steps/PaymentStep.tsx",
  "app/curated-hampers/page.tsx",
  "styles/curated-flow-20261015.css",
  "app/globals.css",
  "package.json",
  "config/self-build-delivery.ts"
].map(read))

// Only the curated customer journey hides sizes; pricing/inventory/DB data are not modified.
assert(!flow.includes("item.size") && !flow.includes("tier.size") &&
  !flow.includes("<dt>Size</dt>") && !flow.includes("Size:"),
  "Curated budget cards, occasion, review and sticky summary must not disclose hamper sizes")
assert(flow.includes('hideTierSize') && flow.includes('quickStart') &&
  flow.includes('onBackToCurated={() => changeScreen(3)}'),
  "The curated payment recap must hide size and allow return to details")
assert(builder.includes("hideTierSize = false") &&
  builder.includes("hideTierSize?: boolean") &&
  builder.includes('!hideTierSize && <div><dt>Size</dt><dd>{state.tier.size}</dd></div>'),
  "Homepage quick builder must continue showing real tier sizes unless explicitly hidden")
assert(builder.includes('onBack={() => moveToStep(2)}') &&
  builder.includes("onSubmit={submit}") && builder.includes("onPay={pay}"),
  "Do not disrupt payment back/submit/gateway actions")
assert(flow.includes('formatMoney(hamperFinalPriceRupees(item.price))') &&
  flow.includes('formatMoney(payable)') &&
  delivery.includes("HAMPER_DELIVERY_FEE_PAISE = SELF_BUILD_DELIVERY_FEE_PAISE"),
  "Customer price must remain inclusive of the existing hamper delivery fee")
assert(flow.includes('Choose your budget') &&
  flow.includes('What are we celebrating?') &&
  flow.includes('Add details & review') &&
  flow.includes('Review & Pay') &&
  !flow.includes("curatedFlowIntro") && !flow.includes("curatedProgress"),
  "Three requested screens must be compact and direct, without the removed hero or stepper")
assert(flow.includes('aria-pressed={state.checkout.occasion === occasion}') &&
  flow.includes('state.goToPayment()') &&
  flow.includes("focusCheckoutField(invalid)"),
  "Occasion feedback and checkout validation must remain accessible")
assert(details.includes('data-checkout-field="customerName"') &&
  details.includes('data-checkout-field="phone"') &&
  details.includes('data-checkout-field="address"') &&
  details.includes('data-checkout-field="requiredDate"') &&
  details.includes('titleOverride || copy.title') &&
  details.includes('nextLabel || copy.next'),
  "Reuse existing validated delivery fields with curated-only labels")
assert(payment.includes('onClick={automatedPaymentClick}') &&
  payment.includes('onClick={onLogin}') &&
  payment.includes("onAccepted(e.target.checked)"),
  "Customer authentication, consent and payment gateway stay unchanged")
assert(route.includes("getCatalogConfig()") &&
  route.includes("getStoreSettings()") &&
  route.includes('<CuratedHamperFlow catalog={catalog} />'),
  "Use live catalog and store settings on the dedicated curated route")
assert(styles.includes(".curatedFlowPage .curatedBudgetGrid") &&
  styles.includes(".curatedFlowPage .curatedDetailsScreen") &&
  styles.includes("@media(max-width:600px)"),
  "Keep responsive styles isolated to this page")
assert(globals.includes('@import "../styles/curated-flow-20261015.css";') &&
  globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Keep page CSS included and protected global CSS ordering intact")
assert(packageRaw.includes("test-curated-flow-20261015.mjs"),
  "Run the curated flow pre-release contract on every CI and production verification")

console.log("CURATED_FLOW_RELEASE_READY: size hidden only for curated checkout, prices and mobile layout preserved, existing homepage/payment untouched.")
