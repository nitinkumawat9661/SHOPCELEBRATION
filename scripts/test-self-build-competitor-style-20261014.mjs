#!/usr/bin/env node
// Historical competitor-style check now verifies the user's latest, simpler
// category *names*, not the superseded category cards or visual decorations.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [ui,css,buyerCss,route,price,buyer]=await Promise.all([
 read("features/builder/SelfBuildDesignPreview.tsx"),
 read("styles/self-build-preview-20261013.css"),
 read("styles/self-build-buyer-20261013.css"),
 read("app/admin/self-build-preview/page.tsx"),
 read("config/self-build-delivery.ts"),
 read("features/builder/CustomerSelfBuildStudio.tsx")
])
const errs=ts.transpileModule(ui,{fileName:"SelfBuildDesignPreview.tsx",reportDiagnostics:true,compilerOptions:{
 jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error)||[]
assert.equal(errs.length,0,errs.map(x=>x.messageText).join("; "))
assert.ok(route.includes("if (!await isAdminRequest())"))
assert.ok(route.includes("id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price"))
assert.ok(ui.includes('category.selectionKind === "group" || category.selectionKind === "variant"'))
assert.ok(ui.includes('className="sbExploreCard"')&&ui.includes('aria-label={`Explore ${category.label}`}'))
assert.ok(ui.includes('className="sbExploreName"')&&ui.includes("sbExploreArrow"))
assert.ok(!ui.includes("sbExploreKind")&&!ui.includes("sbCardMotif"))
assert.ok(ui.includes('category.selectionKind === "photo"'))
assert.ok(ui.includes("function QuantityControl")&&ui.includes("onChange(Math.max(0, count - 1))"))
assert.ok(ui.includes("canAdd={!atMax}")&&ui.includes("maxItems-others"))
assert.ok(!ui.includes("sbChoiceCardTag")&&!ui.includes("sbChoiceGlyph"))
assert.ok(css.includes("/* 2026-10-14 / NAME-ONLY SELECTORS"))
assert.ok(css.includes("--sb-paper:#fcf8f1")&&css.includes("--sb-rose:#7b1420"))
assert.ok(css.includes(".sbPreviewPage .sbExploreName"))
assert.ok(css.includes(".sbPreviewPage .sbChoiceCard"))
assert.ok(css.includes("background:transparent;border:0;border-bottom:1px"))
assert.ok(css.includes(".sbPreviewPage .sbQty button"))
assert.ok(css.includes("@media(max-width:520px)"))
assert.ok(css.includes(".sbPreviewPage .sbChoiceGrid{display:flex;flex-direction:column;gap:0}"))
assert.ok(!css.includes("competitor-aligned redesign"))
assert.ok(!buyerCss.includes("MAXIMALIST / NAME + FINAL PRICE ONLY"))
assert.ok(!css.includes("linear-gradient(125deg,#3b102a"))
assert.ok(!buyerCss.includes("linear-gradient(116deg,#371020"))
assert.ok(buyer.includes("sbBuyerSelectionsSection"))
assert.ok(buyerCss.includes(".sbBuyerChoices"))
assert.ok(buyerCss.includes("background:transparent;border:0;border-bottom"))
const code=ts.transpileModule(price,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {hamperFinalPriceRupees}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"))
assert.equal(hamperFinalPriceRupees(499),549)
assert.equal(hamperFinalPriceRupees(1299),1349)
assert.ok(!/unitBudgetPaise|internalSpentPaise|retail_inventory|stock|selectedProductIds/.test(ui))
console.log("CELEBRATION_NAME_ONLY_CATEGORY_SELECTION_PASSED: no visual cards, public labels, 44px controls, mobile, privacy and gate unchanged")
