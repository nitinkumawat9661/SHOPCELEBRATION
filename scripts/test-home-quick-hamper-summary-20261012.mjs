import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),"utf8")
const [builder,styles,imports,curated,discovery,tail,details,packageRaw,orderSummary,customerCopy]=await Promise.all([
  "features/builder/HamperBuilder.tsx",
  "styles/hamper-builder-selection-preview-20261012.css",
  "app/globals.css",
  "features/builder/CuratedHamperFlow.tsx",
  "features/home/StorefrontDiscovery.tsx",
  "features/home/StorefrontTail.tsx",
  "features/builder/steps/DetailsStep.tsx",
  "package.json",
  "features/builder/components/OrderSummary.tsx",
  "lib/domain/content.ts"
].map(read))

assert(builder.includes('className="quickHamperSummary quickHamperSummary--premium"'),"Quick-selected hamper preview is shown only after a chosen budget")
assert(builder.includes("quickStart && <section"),"Do not duplicate the summary for the full builder")
assert(builder.includes("{state.tier.name}")&&builder.includes("{formatMoney(hamperFinalPriceRupees(state.tier.price))}")&&builder.includes("{state.checkout.occasion}")&&builder.includes("{state.tier.size}"),
  "Selected hamper details must always be real tier/occasion data")
assert(builder.includes("Complete hamper price, not just the box."),"Do not imply a budget represents packaging-only price")
assert(builder.includes('<dl className="quickHamperFacts">')&&builder.includes("<dt>Final price</dt>")&&builder.includes("<dt>Occasion</dt>")&&builder.includes("<dt>Size</dt>"),
  "Inclusive final price, occasion and size should be accessible description-list data")
assert(builder.includes('onClick={changeBudget}')&&builder.includes("state.goToStep(1)"),
  "Change budget must open the existing genuine tier picker without dangling #budgets link")
assert(builder.includes('quickStart ? "quickSteps quickSteps--premium" : "fourSteps"')&&builder.includes('quickStepNumber'),
  "Quick-start has clear numbered Delivery/Payment stages while full builder flow remains")
assert(builder.includes('state.step === 2 && <DetailsStep')&&builder.includes('state.step === 3 && <div data-payment-checkout><PaymentStep'),
  "The real delivery/payment components remain untouched")
assert(builder.includes("onNext={moveToPayment}")&&builder.includes("onSubmit={submit}")&&builder.includes("onPay={pay}"),
  "Preserve address validation and order/payment wiring")
assert(curated.includes("chooseBudget(item.id)")&&discovery.includes("openBuilder(1)")&&
  !discovery.includes("<BudgetSection"),
  "Dedicated budget flow remains functional, while old homepage rail is removed")
assert(tail.includes("<LazyHamperBuilder state={state} active={builderActive} quickStart={quickStart} />"),
  "No extra builder instance or altered order state")
assert(details.includes('data-checkout-field="customerName"')&&details.includes('data-checkout-field="phone"'),
  "Required delivery fields are unchanged")
assert(styles.includes(".celebrationHome .quickBuilder")&&styles.includes(".quickHamperSummary--premium")&&styles.includes(".quickSteps--premium"),
  "CSS must affect only active homepage hamper builder")
assert(styles.includes("@media(max-width:700px)")&&styles.includes("@media(max-width:360px)"),
  "Selection recap and progress fit phones, including narrow widths")
assert(styles.includes("grid-template-columns:repeat(3,minmax(0,1fr))")&&styles.includes("overflow-wrap:break-word")&&styles.includes("white-space:normal"),
  "Real hamper info wraps without clipped words or overlaid text")
assert(styles.includes("min-height:44px")&&styles.includes(":focus-visible"),
  "Change budget button and quick-stage controls are touch/keyboard accessible")
assert(styles.includes("prefers-reduced-motion:reduce"),"Respect reduced-motion preferences")
assert(!styles.includes(".celebrationCategories")&&!styles.includes(".celebrationFeatured")&&!styles.includes(".celebrationBudgets"),
  "Product and builder styles remain scoped; no change to jewellery or categories")
assert(imports.includes('@import "../styles/hamper-builder-selection-preview-20261012.css";'),
  "New builder CSS is actually included in production")
assert(imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Keep protected jewelry collection layout CSS ordering")
assert(packageRaw.includes("test-home-quick-hamper-summary-20261012.mjs"),
  "Always run summary and step-navigation regression checks during PR and VPS audit")
assert(orderSummary.includes('Chosen by Celebration') && !orderSummary.includes('tier.maxChoices} items'),
  "Curated hamper summary must not claim a fixed item count that was never verified")
assert(orderSummary.includes('formatMoney(hamperFinalPriceRupees(tier.price))') && orderSummary.includes('checkout.requiredDate'),
  "Pricing and preferred date still use real order fields")
assert(customerCopy.includes('requiredBy: "Requested delivery date"') &&
 customerCopy.includes('Preferred delivery date *') &&
 customerCopy.includes('not a guaranteed courier arrival date'),
  "Requested gift date must not be advertised as a courier delivery guarantee")
console.log("Quick hamper builder UI safety passed: real selected budget/occasion/size, unchanged delivery/payment events, accessible mobile summary, protected store cards.")
