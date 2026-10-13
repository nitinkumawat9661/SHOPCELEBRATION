#!/usr/bin/env node
// Read-only verification of dormant Self-Build customer UI. No live orders,
// payments, R2 uploads, production settings, inventory or SKU access.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [ui,css,route,draft,price]=await Promise.all([
 read("features/builder/CustomerSelfBuildStudio.tsx"),
 read("styles/self-build-buyer-20261013.css"),
 read("app/self-build/page.tsx"),
 read("lib/server/self-build-drafts.ts"),
 read("config/self-build-delivery.ts")
])
assert.equal(ts.transpileModule(ui,{fileName:"CustomerSelfBuildStudio.tsx",
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
 jsx:ts.JsxEmit.Preserve},reportDiagnostics:true}).diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0)
assert.match(route,/customerSelfBuildEnabled\(\)\.catch\(\(\)=>false\)/)
assert.match(route,/if\(!enabled\)/)
assert.match(draft,/customer_enabled===true/)
// Presentation may group public labels, but must not re-key payload or alter
// original server-side selection, unit quantities, budget, or payment gate.
for(const text of [
 'grouped.map(item=>',
 'sbBuyerFlatChoices',
 'sbBuyerChoiceText',
 'setBuyerStep("select")',
 'sbBuyerUpgradeDialog',
 'sbBuyerChoiceActive',
 'selectedUnits>=maxUnits',
 'const total=Object.values(v).reduce',
 'kind,id:choiceId,quantity:value',
 'selections:items',
 'photos.length===photoQuantity',
 'selfBuildShippingPaise',
]) {
 if(text==="selfBuildShippingPaise")continue
 assert.ok(ui.includes(text),"Missing safe UI contract: "+text)
}
assert.ok(!ui.includes('aria-label="Hamper pieces selected"'))
assert.ok(!ui.includes('aria-valuenow={Math.min(selectedUnits,maxUnits)}'))
assert.ok(ui.includes('aria-label="Your selected gifts"'))
assert.ok(ui.includes('labelOf(data,item)'))
assert.ok(ui.includes('role="status" aria-live="polite"'))
assert.ok(ui.includes('inputMode={name==="pincode"?"numeric":undefined}'))
assert.ok(ui.includes('maxLength={name==="pincode"?6:name==="address"?240:100}'))
assert.ok(!ui.includes('There is no SKU mapping and no per-piece price.'))
assert.ok(!ui.includes('unitBudgetPaise')&&!ui.includes('targetPaise')&&!ui.includes('internalSpentPaise'))
assert.ok(ui.includes('hamperFinalPriceRupees(t.price)')&&ui.includes('hamperFinalPriceRupees(tier.price)'))
assert.ok(!ui.includes("<small>Delivery</small>"))
assert.ok(price.includes("HAMPER_DELIVERY_FEE_PAISE = SELF_BUILD_DELIVERY_FEE_PAISE"))
assert.ok(ui.includes('two days after actual delivery'))
for(const selector of [".sbBuyerFlatChoices",".sbBuyerChoiceActive",".sbBuyerChosenTier",
 ".sbBuyerSelected",".sbBuyerQty button"])assert.ok(css.includes(selector),"Missing polished style: "+selector)
assert.ok(css.includes("min-height:44px")&&css.includes("@media(max-width:650px)"))
assert.ok(css.includes(":focus-visible")&&css.includes("prefers-reduced-motion:reduce"))
console.log("SELF_BUILD_GATED_UI_POLISH_PASSED: public categories grouped, original selection quantities, no hidden cost exposure, inclusive price, accessible mobile, checkout remains OFF")
