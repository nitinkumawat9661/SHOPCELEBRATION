#!/usr/bin/env node
// Historic test renamed in effect: no staged category navigation.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [ui,css,buyerCss,route,price,buyer]=await Promise.all([
 read("features/builder/SelfBuildDesignPreview.tsx"),read("styles/self-build-preview-20261013.css"),
 read("styles/self-build-buyer-20261013.css"),read("app/admin/self-build-preview/page.tsx"),
 read("config/self-build-delivery.ts"),read("features/builder/CustomerSelfBuildStudio.tsx")
])
const {diagnostics=[]}=ts.transpileModule(ui,{fileName:"SelfBuildDesignPreview.tsx",reportDiagnostics:true,
 compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
assert.equal(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0)
assert.ok(route.includes("if (!await isAdminRequest())"))
assert.ok(route.includes("id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price"))
assert.ok(ui.includes("buildSelfBuildGiftSections(data)"))
assert.ok(ui.includes('group={choice.groupLabel===section.label?"":choice.groupLabel}'))
assert.ok(ui.includes('visibleSections.map(section=>'))
assert.ok(!ui.includes("sbExploreCard")&&!ui.includes("sbBreadcrumb"))
assert.ok(ui.includes('function QuantityControl')&&ui.includes("onChange(Math.max(0, count - 1))"))
assert.ok(ui.includes("maxItems-others")&&ui.includes("setUpgradeOpen(true)"))
assert.ok(ui.includes('step==="tier"')&&ui.includes('step==="categories"')&&ui.includes('step==="choose"'))
assert.ok(css.includes("font:italic")&&css.includes(".sbPreviewPage .sbChoiceLabel"))
assert.ok(css.includes("--sb-ink:#331d24")&&css.includes(".sbPreviewPage .sbPreviewTierPrice"))
assert.ok(css.includes("@media(max-width:600px)")&&css.includes("min-height:44px"))
assert.ok(buyerCss.includes(".sbBuyerFlatChoices")&&buyerCss.includes("font:italic"))
assert.ok(buyer.includes("visibleSections.map(section=>"))
const p=ts.transpileModule(price,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}})
const {hamperFinalPriceRupees}=await import("data:text/javascript;base64,"+Buffer.from(p.outputText).toString("base64"))
assert.equal(hamperFinalPriceRupees(499),549)
assert.equal(hamperFinalPriceRupees(1299),1349)
assert.ok(!/unitBudgetPaise|internalSpentPaise|retail_inventory|stock|selectedProductIds/.test(ui))
console.log("SELF_BUILD_FLAT_PREMIUM_CATEGORY_LAYOUT_PASSED")
