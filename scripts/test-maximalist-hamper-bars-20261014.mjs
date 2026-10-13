#!/usr/bin/env node
// Source regression: bold italic, name + final price, click navigates to gifts.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [route,preview,buyer,previewCss,buyerCss,price,limits,customerPage]=await Promise.all([
 read("app/admin/self-build-preview/page.tsx"),read("features/builder/SelfBuildDesignPreview.tsx"),
 read("features/builder/CustomerSelfBuildStudio.tsx"),read("styles/self-build-preview-20261013.css"),
 read("styles/self-build-buyer-20261013.css"),read("config/self-build-delivery.ts"),
 read("lib/server/self-build-tier-limits.ts"),read("app/self-build/page.tsx")
])
for(const [name,src]of [["preview",preview],["buyer",buyer]]){
 const {diagnostics=[]}=ts.transpileModule(src,{fileName:name+".tsx",reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
 assert.equal(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,"TSX "+name)
}
assert.ok(route.includes('if (!await isAdminRequest())'))
assert.ok(route.includes("id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price"))
assert.ok(customerPage.includes("customerSelfBuildEnabled().catch(()=>false)")&&customerPage.includes("if(!enabled)"))
assert.ok(preview.includes('className="sbPreviewTierName"')&&preview.includes('className="sbPreviewTierPrice"'))
assert.ok(preview.includes('onClick={()=>chooseTier(item.id)}')&&preview.includes('setStep("categories")'))
assert.ok(preview.includes('step==="tier"')&&preview.includes('step==="categories"')&&preview.includes('step==="choose"'))
assert.ok(buyer.includes('className="sbBuyerTierName"')&&buyer.includes('className="sbBuyerTierPrice"'))
assert.ok(buyer.includes('setTierId(t.id);setBuyerStep("categories")'))
assert.ok(preview.includes("formatMoney(hamperFinalPriceRupees(item.price))"))
assert.ok(buyer.includes("formatMoney(hamperFinalPriceRupees(t.price))"))
assert.ok(!preview.includes("MAXIMUM PIECES")&&!buyer.includes("TOTAL PIECES IN YOUR HAMPER"))
assert.ok(preview.includes("maxItems-others")&&buyer.includes("selectedUnits>=maxUnits"))
assert.ok(preview.includes("setUpgradeOpen(true)")&&buyer.includes("setUpgradeOpen(true)"))
assert.ok(preview.includes("visibleSections.map(section=>")&&buyer.includes("visibleSections.map(section=>"))
assert.ok(!/unitBudgetPaise|internalSpentPaise|targetPaise/.test(preview+buyer))
const result=ts.transpileModule(price,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
const {hamperFinalPriceRupees}=await import("data:text/javascript;base64,"+Buffer.from(result.outputText).toString("base64"))
for(const p of [299,499,999,1299,1499])assert.equal(hamperFinalPriceRupees(p),p+50)
assert.ok(limits.includes("targetPercent")&&limits.includes("tier.price"))
for(const css of [previewCss,buyerCss]){
 assert.ok(css.includes("font:italic")&&css.includes("#741e38")&&css.includes("min-height:44px"))
 assert.ok(css.includes("prefers-reduced-motion")&&css.includes(":focus-visible"))
}
console.log("SELF_BUILD_PRICED_NAME_WIZARD_PASSED: tier/price first, automatic next step, no visible max, all options flat, original budget and gate")
