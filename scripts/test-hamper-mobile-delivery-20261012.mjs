import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),"utf8")
const [details,css,globals,builder,cartCss,selectionCss,packageRaw]=await Promise.all([
  "features/builder/steps/DetailsStep.tsx",
  "styles/hamper-builder-mobile-delivery-20261012.css",
  "app/globals.css",
  "features/builder/HamperBuilder.tsx",
  "styles/cart-delivery-compact.css",
  "styles/hamper-builder-selection-preview-20261012.css",
  "package.json"
].map(read))

assert(details.includes('individual ? "stepPane active cartDeliveryStep" : "stepPane active hamperDeliveryStep"'),
  "Hamper delivery styling must never change the independent cart delivery workflow")
assert(css.includes(".celebrationHome #builder.quickBuilder .hamperDeliveryStep") &&
  css.includes(".checkoutSectionCard") && css.includes(".checkoutSectionHead"),
  "Limit mobile restyling to the active custom-hamper quick-start delivery form")
assert(!css.includes(".cartPage") && !css.includes(".marketCartCheckoutBuilder") &&
  !css.includes(".celebrationCategories") && !css.includes(".celebrationFeatured"),
  "Do not alter cart checkout, approved circle images or featured products")
assert(css.includes(".checkoutFormGrid .control") && css.includes("font:400 16px/1.4"),
  "Mobile form text must remain readable and prevent iOS focus zoom")
assert(css.includes("min-height:49px") && css.includes("min-height:44px") &&
  css.includes("min-height:47px"),"Input fields and all action buttons remain touch-friendly")
assert(css.includes("width:100%") && css.includes("min-width:0") &&
  css.includes("overflow-wrap:break-word"),
  "Long location or saved-address strings must not overflow the phone viewport")
assert(css.includes(".field.invalid .control") && css.includes(".fieldError") &&
  css.includes(":focus-visible"),"Validation/focus feedback must remain visible")
assert(css.includes('input[type=date]') && css.includes("color-scheme:light"),
  "Native required-date control remains usable")
assert(css.includes(".savedDeliveryChoice") && css.includes(".savedDeliveryActions"),
  "Existing saved delivery-address actions remain visible")
assert(css.includes(".navRow.detailActions") && css.includes(".detailActions .primary"),
  "Existing back/continue-to-payment controls retain clear mobile hierarchy")
assert(css.includes(".summary") && css.includes(".sumPrice"),
  "Real selected-hamper summary remains available")
assert(css.includes("@media(max-width:759px)") && css.includes("@media(max-width:360px)") &&
  css.includes("@media(min-width:980px)"),
  "Layouts must adapt safely from narrow phones to desktop")
assert(css.includes("@media(prefers-reduced-motion:reduce)"),
  "Reduced-motion preference must be respected")

for(const field of ["customerName","phone","receiverName","requiredDate","occasion",
  "pincode","address","city","state","message"]){
  assert(details.includes(`data-checkout-field="${field}"`),
    `The existing checkout field ${field} must remain present`)
}
assert(details.includes("todayForDateInput()") && details.includes('min={todayForDateInput()}'),
  "Keep future delivery-date constraint unchanged")
assert(details.includes('inputMode="numeric"') && details.includes('maxLength={6}') &&
  details.includes('onChange={(e) => updateField("pincode"'),
  "Keep numeric six-digit pincode normalization unchanged")
assert(details.includes('onClick={onUseSavedAddress}') &&
  details.includes('onClick={() => document.querySelector<HTMLTextAreaElement>'),
  "Keep the saved-address use/edit controls fully operational")
assert(details.includes("aria-invalid={Boolean(fieldErrors.requiredDate)}") &&
  details.includes("aria-invalid={Boolean(fieldErrors.address)}"),
  "Preserve existing delivery-field validation state")
assert(details.includes('onClick={onBack}') && details.includes('onClick={onNext}'),
  "Do not change navigation callbacks")
assert(details.includes("{summary || (tier && <OrderSummary tier={tier} checkout={checkout} />)}"),
  "Keep the real tier/occasion/date pricing summary")
assert(builder.includes('state.step === 2 && <DetailsStep') &&
  builder.includes("onNext={moveToPayment}") &&
  builder.includes("onBack={quickStart ? changeBudget : () => moveToStep(1)}"),
  "Do not replace shipping-validation or quick-start navigation logic")
assert(selectionCss.includes(".quickHamperSummary--premium"),
  "Previous approved selected-hamper summary stays active")
assert(cartCss.includes(".cartPage #builder .cartDeliveryStep"),
  "Standalone jewelry/cart checkout retains its own design")
assert(globals.includes('@import "../styles/hamper-builder-mobile-delivery-20261012.css";'),
  "Import new scoped styles in production")
assert(globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Keep protected mobile 2-column jewelry grid stylesheet last")
assert(packageRaw.includes("test-hamper-mobile-delivery-20261012.mjs"),
  "Always run mobile delivery-form guard in PR and VPS source audits")

console.log("Hamper delivery mobile guard passed: scoped readable forms, ten original fields, saved addresses, accessible feedback and unchanged cart/payment wiring.")
