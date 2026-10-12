import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")
const [payment, builder, css, globals, catalogCss, selectionCss, deliveryCss, packageRaw] = await Promise.all([
  "features/builder/steps/PaymentStep.tsx",
  "features/builder/HamperBuilder.tsx",
  "styles/hamper-payment-mobile-premium-20261012.css",
  "app/globals.css",
  "styles/cart-delivery-compact.css",
  "styles/hamper-builder-selection-preview-20261012.css",
  "styles/hamper-builder-mobile-delivery-20261012.css",
  "package.json"
].map(read))

const target = ".celebrationHome #builder.quickBuilder [data-payment-checkout]"
assert(css.includes(target), "Styles must apply only to the homepage's active quick-start payment screen")
assert(css.includes(".builderCard:has([data-payment-checkout])"),
  "Do not modify the builder container unless the payment step is active")
for(const wrong of [".cartPage", ".celebrationCategories", ".celebrationFeatured", ".celebrationBudgets", ".cartDeliveryStep"]){
  assert(!css.includes(wrong), `New payment CSS must not change already approved store areas: ${wrong}`)
}
for(const selector of [
  ".builderTitle", ".paymentAmount", ".checkoutAccount", ".checkoutCoupon",
  ".checkoutOfferCard", ".policyCheck", ".paymentPolicyHint", ".paymentBox",
  ".paymentSteps", ".paymentStateCard", ".paymentStateActions", ".utrField",
  ".navRow.paymentActions", ".trustCard", ".successActions"
]) {
  assert(css.includes(selector), `Must present complete existing payment UI clearly: ${selector}`)
}
assert(css.includes("min-height:52px") && css.includes("min-height:44px") &&
  css.includes("min-height:46px") && css.includes("font:400 16px"),
  "Touch targets and mobile input font sizes must remain accessible")
assert(css.includes("grid-template-columns:minmax(0,1fr)") &&
  css.includes("overflow-wrap:break-word") && css.includes("white-space:normal"),
  "Payment area must fit a narrow viewport without clipping amounts or order details")
assert(css.includes("@media(max-width:759px)") && css.includes("@media(max-width:360px)") &&
  css.includes("@media(min-width:900px)"),
  "Adapt layouts at mobile, very small mobile and desktop sizes")
assert(css.includes(":focus-visible") && css.includes("@media(prefers-reduced-motion:reduce)"),
  "Respect keyboard accessibility and reduced-motion preference")
assert(!css.includes("pointer-events:none") && !css.includes("display:none"),
  "Do not hide payment controls, errors, legal policies or blocked/pending statuses")

// Shipping, payment and account behavior is owned by existing components.
// This task deliberately changes no business-logic source code.
assert(builder.includes('state.step === 3 && <div data-payment-checkout><PaymentStep'),
  "Original PaymentStep and callbacks must stay wired to the quick hamper builder")
assert(builder.includes("onSubmit={submit}") && builder.includes("onPay={pay}") &&
  builder.includes("onRefreshPayment={() => void order.refreshPayment()}") &&
  builder.includes("onBack={() => moveToStep(2)}"),
  "Order placement, gateway, polling and return-to-delivery callbacks are unchanged")
assert(payment.includes("gatewayEnabled && paymentPending") &&
  payment.includes("gatewayEnabled && paymentFailed") &&
  payment.includes('role="alert"'),
  "Pending, failed, warning and error states remain visible")
assert(payment.includes('onClick={automatedPaymentClick}') &&
  payment.includes("href={upiUrl}") &&
  payment.includes("onClick={() => onSubmit(quote?.id)}"),
  "Secure gateway and manual UPI modes must retain their distinct payment logic")
assert(payment.includes("onClick={onLogin}") &&
  payment.includes("onClick={() => void applyCoupon()}") &&
  payment.includes('onClick={() => void clearCoupon()}'),
  "Account authentication and coupon apply/remove are unchanged")
assert(payment.includes('checked={accepted}') && payment.includes("onAccepted(e.target.checked)") &&
  payment.includes("href={routes.policies}") &&
  payment.includes("href={routes.terms}") &&
  payment.includes("href={routes.privacy}"),
  "Legal acknowledgments and customer consent remain enforced")
assert(payment.includes("onClick={onRefreshPayment}") &&
  payment.includes("onClick={onNewOrder}") &&
  payment.includes("onClick={onWhatsapp}"),
  "Order/payment-status recovery and support actions are unchanged")
assert(catalogCss.includes(".cartPage #builder .cartDeliveryStep") &&
  selectionCss.includes(".quickHamperSummary--premium") &&
  deliveryCss.includes(".hamperDeliveryStep"),
  "Previous cart, quick-start summary and delivery sections remain unchanged")
assert(globals.includes('@import "../styles/hamper-payment-mobile-premium-20261012.css";'),
  "Payment styles must ship with production CSS")
assert(globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Protected /jewelry listing override must remain the last stylesheet")
assert(packageRaw.includes("test-hamper-payment-premium-20261012.mjs"),
  "Always verify payment presentation regressions in PR and release audits")

console.log("Quick hamper payment UI safety checks passed: gateway/manual UPI, login, offers, coupons, policy consent, states, status recovery, accessible mobile styling and unchanged checkout logic.")
