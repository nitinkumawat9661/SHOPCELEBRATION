#!/usr/bin/env node
// The historical tier-bar test now guards the owner-approved simpler design:
// selectable hamper names only, with final price shown outside the selector.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [adminRoute,preview,buyer,previewCss,buyerCss,price,limits,customerPage]=await Promise.all([
 read("app/admin/self-build-preview/page.tsx"),
 read("features/builder/SelfBuildDesignPreview.tsx"),
 read("features/builder/CustomerSelfBuildStudio.tsx"),
 read("styles/self-build-preview-20261013.css"),
 read("styles/self-build-buyer-20261013.css"),
 read("config/self-build-delivery.ts"),
 read("lib/server/self-build-tier-limits.ts"),
 read("app/self-build/page.tsx")
])
for(const [name,src] of [["SelfBuildDesignPreview",preview],["CustomerSelfBuildStudio",buyer]]){
 const {diagnostics=[]}=ts.transpileModule(src,{fileName:name+".tsx",reportDiagnostics:true,
 compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
 assert.equal(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,"TSX syntax "+name)
}
assert.ok(adminRoute.includes('if (!await isAdminRequest())')&&
 adminRoute.indexOf('if (!await isAdminRequest())')<adminRoute.indexOf("getSelfBuildVisualData()"))
assert.ok(adminRoute.includes("id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price"))
assert.ok(customerPage.includes("customerSelfBuildEnabled().catch(()=>false)")&&customerPage.includes("if(!enabled)"))
const previewNames=preview.split('<div className="sbPreviewTierBars">')[1]?.split('</div>')[0]
const buyerNames=buyer.split('<div className="sbBuyerTiers" role="group" aria-label="Hamper names">')[1]?.split('</div>')[0]
assert.ok(previewNames&&buyerNames,"Tier names must be visible and selectable on both surfaces")
for(const [s,prefix]of [[previewNames,"sbPreviewTierBar"],[buyerNames,"sbBuyerTierBar"]]){
 assert.ok(s.includes("aria-pressed={tierId===")&&s.includes("onClick={()=>setTierId(")&&
   s.includes(prefix==="sbPreviewTierBar"?"{item.name}":"{t.name}"),
 "Same tier selected by clicking its real catalog name")
 assert.ok(s.includes(prefix))
 assert.ok(!/<span\b|<strong\b|<small\b|<img\b|<svg\b|<p\b|formatMoney\(|hamperFinalPriceRupees\(/.test(s),
 "No price, description, illustration, count or extra content in name options")
}
assert.ok(preview.includes('className="sbPreviewTierTotal"') &&
 preview.includes("formatMoney(hamperFinalPriceRupees(tier.price))"))
assert.ok(buyer.includes('className="sbBuyerTierTotal"')&&
 buyer.includes("formatMoney(hamperFinalPriceRupees(tier.price))"))
assert.ok(preview.includes("const maxItems=tier?.maxChoices||0")&&preview.includes("maxItems-others"))
assert.ok(buyer.includes("selectedUnits>=maxUnits")&&buyer.includes("selections:items"))
assert.ok(!/unitBudgetPaise|internalSpentPaise|targetPaise/.test(preview+buyer))
const t=ts.transpileModule(price,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const pricing=await import("data:text/javascript;base64,"+Buffer.from(t).toString("base64"))
for(const base of [299,499,999,1299,1499])assert.equal(pricing.hamperFinalPriceRupees(base),base+50)
assert.ok(limits.includes("targetPercent")&&limits.includes("tier.price")&&!buyer.includes("getSelfBuildTierLimits"))
assert.ok(previewCss.includes(".sbPreviewTierBar--active")&&buyerCss.includes(".sbBuyerTierBar[aria-pressed=true]"))
assert.ok(previewCss.includes("background:transparent")&&buyerCss.includes("background:transparent"))
assert.ok(!previewCss.includes("linear-gradient(125deg,#3b102a")&&!buyerCss.includes("linear-gradient(116deg,#371020"))
assert.ok(previewCss.includes(":focus-visible")&&buyerCss.includes(":focus-visible"))
console.log("HAMPPER_NAME_ONLY_SELECTORS_PASSED: names clickable, price separate and inclusive, original tier budget preserved, customer gate closed")
