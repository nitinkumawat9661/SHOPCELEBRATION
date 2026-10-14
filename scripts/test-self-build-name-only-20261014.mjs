#!/usr/bin/env node
// Revised owner intent: names and final prices on the selection screen.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const r=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [admin,buyer,adminCss,buyerCss,route,server,price]=await Promise.all([
 r("features/builder/SelfBuildDesignPreview.tsx"),r("features/builder/CustomerSelfBuildStudio.tsx"),
 r("styles/self-build-preview-20261013.css"),r("styles/self-build-buyer-20261013.css"),
 r("app/self-build/page.tsx"),r("lib/server/orders/self-build-no-inventory.ts"),
 r("config/self-build-delivery.ts")
])
assert.ok(route.includes("customerSelfBuildEnabled().catch(()=>false)")&&route.includes("if(!enabled)"))
assert.ok(server.includes("getSelfBuildTierLimits(chosenTier)")&&server.includes("selfBuildShippingPaise:SELF_BUILD_DELIVERY_FEE_PAISE"))
assert.ok(price.includes("HAMPER_DELIVERY_FEE_PAISE = SELF_BUILD_DELIVERY_FEE_PAISE"))
for(const x of [admin,buyer]){
 const parsed=ts.transpileModule(x,{fileName:"component.tsx",reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
 assert.equal(parsed.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length||0,0)
 assert.ok(x.includes("hamperFinalPriceRupees("))
 assert.ok(!x.includes("MAXIMUM PIECES")&&!x.includes("TOTAL PIECES IN YOUR HAMPER"))
 assert.ok(!/unitBudgetPaise|targetPaise|internalSpentPaise/.test(x))
}
assert.ok(admin.includes('className="sbPreviewTierPrice"')&&admin.includes('className="sbPreviewTierName"'))
assert.ok(buyer.includes('className="sbBuyerTierPrice"')&&buyer.includes('className="sbBuyerTierName"'))
assert.ok(admin.includes("chooseTier(item.id)")&&buyer.includes('setBuyerStep("select")'))
assert.ok(admin.includes("visibleSections.map(section=>")&&buyer.includes("visibleSections.map(section=>"))
assert.ok(admin.includes('className="sbChoiceGrid"')&&buyer.includes('sbBuyerFlatChoices'))
assert.ok(admin.includes("upgradeOpen")&&buyer.includes("upgradeOpen"))
assert.ok(adminCss.includes(".sbPreviewPage .sbPreviewTierPrice"))
assert.ok(buyerCss.includes(".sbBuyerTiers .sbBuyerTierBar .sbBuyerTierPrice"))
console.log("SELF_BUILD_PLAIN_GIFT_CHOICES_AND_PRICED_TIER_WIZARD_PASSED")
