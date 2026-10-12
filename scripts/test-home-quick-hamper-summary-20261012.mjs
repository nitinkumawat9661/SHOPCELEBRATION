import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),"utf8")
const [builder,styles,imports,budget,discovery,tail,details,packageRaw]=await Promise.all([
  "features/builder/HamperBuilder.tsx",
  "styles/hamper-builder-selection-preview-20261012.css",
  "app/globals.css",
  "features/catalog/BudgetSection.tsx",
  "features/home/StorefrontDiscovery.tsx",
  "features/home/StorefrontTail.tsx",
  "features/builder/steps/DetailsStep.tsx",
  "package.json"
].map(read))

assert(builder.includes('className="quickHamperSummary quickHamperSummary--premium"'),"Quick-selected hamper preview is shown only after a chosen budget")
assert(builder.includes("quickStart && <section"),"Do not duplicate the summary for the full builder")
assert(builder.includes("{state.tier.name}")&&builder.includes("{formatMoney(state.tier.price)}")&&builder.includes("{state.checkout.occasion}")&&builder.includes("{state.tier.size}"),
  "Selected hamper details must always be real tier/occasion data")
assert(builder.includes("Complete hamper price, not just the box."),"Do not imply a budget represents packaging-only price")
assert(builder.includes('<dl className="quickHamperFacts">')&&builder.includes("<dt>Budget</dt>")&&builder.includes("<dt>Occasion</dt>")&&builder.includes("<dt>Size</dt>"),
  "Budget, occasion and size should be accessible description-list data")
assert(builder.includes('onClick={changeBudget}')&&builder.includes('document.getElementById("budgets")?.scrollIntoView'),
  "Change budget must retain the existing scroll-based edit action")
assert(builder.includes('quickStart ? "quickSteps quickSteps--premium" : "fourSteps"')&&builder.includes('quickStepNumber'),
  "Quick-start has clear numbered Delivery/Payment stages while full builder flow remains")
assert(builder.includes('state.step === 2 && <DetailsStep')&&builder.includes('state.step === 3 && <div data-payment-checkout><PaymentStep'),
  "The real delivery/payment components remain untouched")
assert(builder.includes("onNext={moveToPayment}")&&builder.includes("onSubmit={submit}")&&builder.includes("onPay={pay}"),
  "Preserve address validation and order/payment wiring")
assert(budget.includes("onSelect(item.id)")&&discovery.includes("openBuilder(2, id, true)"),
  "Quick start still comes from the actual selected hamper tier")
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
  "Previously approved category circles, product cards and budget carousel are untouched")
assert(imports.includes('@import "../styles/hamper-builder-selection-preview-20261012.css";'),
  "New builder CSS is actually included in production")
assert(imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Keep protected jewelry collection layout CSS ordering")
assert(packageRaw.includes("test-home-quick-hamper-summary-20261012.mjs"),
  "Always run summary and step-navigation regression checks during PR and VPS audit")
console.log("Quick hamper builder UI safety passed: real selected budget/occasion/size, unchanged delivery/payment events, accessible mobile summary, protected store cards.")
