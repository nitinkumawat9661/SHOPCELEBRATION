#!/usr/bin/env node
// Hamper customer price = published tier + ₹50 (no separate checkout line).
// The existing tier stays intact for product selection and internal 80/75% budgets.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

async function source(path) {
  return readFile(new URL("../"+path, import.meta.url), "utf8")
}
async function exportedTs(path) {
  const js=ts.transpileModule(await source(path),{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  }).outputText
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"))
}
const [delivery,limits]=await Promise.all([
  exportedTs("config/self-build-delivery.ts"),
  exportedTs("lib/server/self-build-tier-limits.ts")
])
const {hamperFinalPriceRupees}=delivery
assert.equal(delivery.HAMPER_DELIVERY_FEE_PAISE,5000)
for(const [base,final,percent,maxChoices] of [
 [299,349,80,3],[499,549,80,3],[999,1049,80,5],[1299,1349,75,6],[1499,1549,75,6]
]){
 const original={price:base,maxChoices}
 const budget=limits.getSelfBuildTierLimits(original)
 assert.equal(hamperFinalPriceRupees(base),final)
 assert.equal(original.price,base,"Display function must not mutate the published tier")
 assert.equal(budget.targetPercent,percent)
 assert.equal(budget.targetPaise,Math.floor(base*100*percent/100),
   "Budget must always be calculated from the ORIGINAL hamper price")
 assert.equal(budget.ceilingPercent,percent+5)
}
const displayFiles=[
 "features/home/Hero.tsx",
 "features/catalog/BudgetSection.tsx",
 "features/builder/steps/BudgetStep.tsx",
 "features/builder/HamperBuilder.tsx",
 "features/builder/components/OrderSummary.tsx",
 "features/builder/steps/ProductStep.tsx",
 "features/catalog/CatalogCard.tsx",
 "features/builder/CustomerSelfBuildStudio.tsx"
]
for(const path of displayFiles){
 assert.ok((await source(path)).includes("hamperFinalPriceRupees("),
   "No hamper display helper in "+path)
}
const [checkout,selfBuild,create,noStock]=await Promise.all([
 source("features/builder/steps/PaymentStep.tsx"),
 source("features/builder/CustomerSelfBuildStudio.tsx"),
 source("lib/server/orders/create.ts"),
 source("lib/server/orders/self-build-no-inventory.ts")
])
assert.ok(checkout.includes('aria-label="Hamper final price"'))
assert.ok(!checkout.includes('aria-label="Hamper price breakdown"'))
assert.ok(!checkout.includes("delivery at checkout"))
assert.ok(!checkout.includes(" · Delivery"))
assert.ok(checkout.includes("quote.payablePaise + (individual ? 0 : HAMPER_DELIVERY_FEE_PAISE)"),
 "Discounted offer must display grand total including hidden delivery, not base quote")
assert.ok(checkout.includes("productPayablePaise + deliveryPaise"))
assert.ok(!selfBuild.includes("<small>Delivery</small>"))
assert.ok(!selfBuild.includes("Delivery is added at checkout"))
assert.ok(selfBuild.includes('<small>Final price</small>'))
assert.ok(noStock.includes("getSelfBuildTierLimits(chosenTier)"))
assert.ok(noStock.includes("selfBuildShippingPaise:SELF_BUILD_DELIVERY_FEE_PAISE"))
assert.ok(create.includes("productPricing.payablePaise + (shippingPaise || 0)"))
assert.ok(create.includes(": HAMPER_DELIVERY_FEE_PAISE"))
const catalog=JSON.parse(await source("content/catalog.json"))
for(const tier of catalog.tiers){
 const before=tier.price
 assert.equal(hamperFinalPriceRupees(tier.price),before+50)
 assert.equal(limits.getSelfBuildTierLimits(tier).targetPaise,
   Math.floor(Math.round(before*100)* (before>=1299?75:80)/100))
}
console.log("HAMPER_INCLUSIVE_FINAL_PRICE_BUDGET_UNCHANGED_PASSED: all customer tiers show +₹50, server adds once, original 80/75% budgets unchanged, no visible separate delivery line")
