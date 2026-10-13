#!/usr/bin/env node
// Visual contract only. The actual Self-Build order/payment flow stays disabled.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [admin,buyer,adminCss,buyerCss,route,server,price]=await Promise.all([
 read("features/builder/SelfBuildDesignPreview.tsx"),
 read("features/builder/CustomerSelfBuildStudio.tsx"),
 read("styles/self-build-preview-20261013.css"),
 read("styles/self-build-buyer-20261013.css"),
 read("app/self-build/page.tsx"),
 read("lib/server/orders/self-build-no-inventory.ts"),
 read("config/self-build-delivery.ts")
])
for(const [name,src]of [["admin",admin],["buyer",buyer]]){
 const {diagnostics=[]}=ts.transpileModule(src,{fileName:name+".tsx",reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
 assert.equal(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,name+" TSX parse")
}
assert.ok(route.includes("customerSelfBuildEnabled().catch(()=>false)")&&route.includes("if(!enabled)"))
assert.ok(server.includes("getSelfBuildTierLimits(chosenTier)")&&server.includes("selfBuildShippingPaise:SELF_BUILD_DELIVERY_FEE_PAISE"))
assert.ok(price.includes("HAMPER_DELIVERY_FEE_PAISE = SELF_BUILD_DELIVERY_FEE_PAISE"))
const tierA=admin.split('<div className="sbPreviewTierBars">')[1]?.split('</div>')[0]
const tierB=buyer.split('<div className="sbBuyerTiers" role="group" aria-label="Hamper names">')[1]?.split('</div>')[0]
assert.ok(tierA&&tierB)
for(const markup of [tierA,tierB]){
 assert.ok(markup.includes("onClick={()=>setTierId(")&&markup.includes("aria-pressed={tierId==="))
 assert.ok(!/<strong|<span|<img|<small|<p|<svg|<input|formatMoney|hamperFinalPriceRupees/.test(markup),
   "Selectable tiers must contain ONLY their public names")
}
assert.ok(admin.includes('className="sbPreviewTierTotal"')&&buyer.includes('className="sbBuyerTierTotal"'))
assert.ok(admin.includes("formatMoney(hamperFinalPriceRupees(tier.price))")&&buyer.includes("formatMoney(hamperFinalPriceRupees(tier.price))"))
assert.ok(admin.includes('<span className="sbExploreName">{category.label}</span>'))
assert.ok(!admin.includes("sbExploreKind")&&!admin.includes("sbExploreCardBottom"))
assert.ok(admin.includes("<h3>{title}</h3>")&&admin.includes("<QuantityControl label={title}"))
assert.ok(admin.includes("const next=requested<=existing?requested:"))
assert.ok(buyer.includes("selectedUnits>=maxUnits")&&buyer.includes("selections:items"))
assert.ok(!/unitBudgetPaise|targetPaise|internalSpentPaise/.test(admin+buyer))
assert.ok(adminCss.includes("/* 2026-10-14 / NAME-ONLY SELECTORS"))
assert.ok(adminCss.includes(".sbPreviewPage .sbChoiceGrid{")&&adminCss.includes("display:flex;flex-direction:column;gap:0"))
assert.ok(adminCss.includes(".sbPreviewPage .sbExploreName"))
assert.ok(adminCss.includes(".sbPreviewPage .sbChoiceCard{"))
assert.ok(buyerCss.includes("/* 2026-10-14 / BUYER NAME-ONLY SELECTION UI."))
assert.ok(buyerCss.includes(".sbBuyerSelectionsSection.sbBuyerCard"))
assert.ok(buyerCss.includes(".sbBuyerChoice,.sbBuyerChoice.sbBuyerChoiceActive{"))
assert.ok(adminCss.includes("min-height:44px")&&buyerCss.includes("min-height:44px"))
console.log("SELF_BUILD_PLAIN_SELECTABLE_NAMES_PASSED: tier names only, category names only, no cards, separate all-inclusive total, quantity and gate unchanged")
