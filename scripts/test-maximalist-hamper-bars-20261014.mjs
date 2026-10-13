#!/usr/bin/env node
// Presentation-only regression: maximalist horizontal tier bars show only
// the public hamper name and shipping-inclusive final price in admin preview
// and the gated buyer UI. No inventories, payments, R2, database writes.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [adminRoute,preview,buyer,previewCss,buyerCss,price,limits]=await Promise.all([
  read("app/admin/self-build-preview/page.tsx"),
  read("features/builder/SelfBuildDesignPreview.tsx"),
  read("features/builder/CustomerSelfBuildStudio.tsx"),
  read("styles/self-build-preview-20261013.css"),
  read("styles/self-build-buyer-20261013.css"),
  read("config/self-build-delivery.ts"),
  read("lib/server/self-build-tier-limits.ts")
])
function checkTSX(name,code){
 const result=ts.transpileModule(code,{fileName:name,reportDiagnostics:true,
   compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
 const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[]
 assert.equal(errors.length,0,errors.map(e=>String(e.messageText)).join("; "))
}
checkTSX("SelfBuildDesignPreview.tsx",preview)
checkTSX("CustomerSelfBuildStudio.tsx",buyer)
assert.ok(adminRoute.includes('if (!await isAdminRequest())') &&
  adminRoute.indexOf('if (!await isAdminRequest())')<adminRoute.indexOf("getSelfBuildVisualData()"),
  "Private admin design preview must remain authenticated")
assert.ok(adminRoute.includes("id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price"),
  "Admin tier bar uses the public price from the existing published tier")
assert.ok(!adminRoute.includes("unitBudgetPaise")&&!adminRoute.includes("stock"))
const previewBars=preview.match(/<div className="sbPreviewTierBars">([\s\S]*?)<\/div>\s*<\/div>/)?.[1]
const buyerBars=buyer.match(/<div className="sbBuyerTiers">([\s\S]*?)<\/div>\s*<\/section>/)?.[1]
assert.ok(previewBars&&buyerBars,"Both list surfaces must have real tier buttons")
for(const [markup,prefix] of [[previewBars,"sbPreview"],[buyerBars,"sbBuyer"]]){
 assert.ok(markup.includes('aria-pressed={tierId===') &&
   markup.includes('<span className="'+prefix+'TierName">') &&
   markup.includes('<strong className="'+prefix+'TierPrice">'),
   "Tier bars must be accessible with exactly name and final price")
 assert.ok(!/<small|<p\b|<img|<svg|<input|<select|\bmaxChoices\b|\bunitBudgetPaise\b|Delivery|pieces/i.test(markup),
   "No other customer-visible detail may appear inside tier bars")
 assert.equal((markup.match(/<span\b/g)||[]).length,1)
 assert.equal((markup.match(/<strong\b/g)||[]).length,1)
 assert.ok(markup.includes("hamperFinalPriceRupees("),"Tier bars must include the ₹50 hidden-in-final-price fee")
}
assert.ok(!preview.includes('id="sb-preview-tier"'),
  "Dropdown has been replaced with maximalist name/price bars")
assert.ok(preview.includes("const maxItems=tier?.maxChoices||0") &&
  preview.includes("disabled={units === 0 || exceedsMax}") &&
  preview.includes("Math.min(requested,Math.max(0,maxItems-others))"),
  "Changing tier must retain existing maximum-count behavior")
assert.ok(buyer.includes("selectedUnits>=maxUnits") &&
  buyer.includes("selections:items") &&
  buyer.includes("customer.account"),
  "Buyer-side selection count and authenticated draft contract unchanged")
assert.ok(!/targetPaise|unitBudgetPaise|internalSpentPaise/.test(preview+buyer),
  "Do not disclose the private budget")
const transpiled=ts.transpileModule(price,{compilerOptions:{target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.ESNext}}).outputText
const pricing=await import("data:text/javascript;base64,"+Buffer.from(transpiled).toString("base64"))
for(const p of [299,499,999,1299,1499])assert.equal(pricing.hamperFinalPriceRupees(p),p+50)
assert.ok(limits.includes("targetPercent")&&limits.includes("tier.price")&&!buyer.includes("getSelfBuildTierLimits"),
  "Final display does not influence existing 80% / 75% budget calculation")
for(const [css,klass] of [[buyerCss,".sbBuyerTierBar"],[previewCss,".sbPreviewTierBar"]]){
 assert.ok(css.includes(klass)&&css.includes("#7b1420")&&css.includes("#fffdfa")&&css.includes("min-height:44px"),
  "Use Celebration wine/ivory colour system and minimum accessible touch sizing")
 assert.ok(!css.includes("linear-gradient(116deg,#371020")&&!css.includes("linear-gradient(125deg,#3b102a"),
  "The old dark-pink/gold mockup gradients must be removed, not merely obscured")
 assert.ok(css.includes("prefers-reduced-motion")&&css.includes(":focus-visible"),
  "Keep keyboard and motion accessibility")
}
console.log("MAXIMALIST_HAMPER_TIER_BARS_PASSED: only name/price on each bar, delivery included, original tier budget and selection max, preview still admin-only, customer checkout still disabled")
