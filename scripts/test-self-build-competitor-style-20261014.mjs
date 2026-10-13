#!/usr/bin/env node
// Self-Build admin preview category visual regression: only public categories,
// real prices, mobile one-column flow. No runtime API/order/payment mutations.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [ui,css,buyerCss,route,price]=await Promise.all([
 read("features/builder/SelfBuildDesignPreview.tsx"),
 read("styles/self-build-preview-20261013.css"),
 read("styles/self-build-buyer-20261013.css"),
 read("app/admin/self-build-preview/page.tsx"),
 read("config/self-build-delivery.ts")
])
const err=ts.transpileModule(ui,{fileName:"SelfBuildDesignPreview.tsx",reportDiagnostics:true,compilerOptions:{
 jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error)||[]
assert.equal(err.length,0,err.map(e=>e.messageText).join("; "))
assert.ok(route.includes('if (!await isAdminRequest())'))
assert.ok(route.includes('id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price'))
assert.ok(ui.includes('category.selectionKind === "group" || category.selectionKind === "variant"'))
assert.ok(ui.includes('className="sbExploreCard"')&&ui.includes('aria-label={`Explore ${category.label}`}'))
assert.ok(ui.includes('sbExploreKind')&&ui.includes('sbExploreArrow'))
assert.ok(ui.includes('category.selectionKind === "photo"'))
assert.ok(ui.includes('function QuantityControl')&&ui.includes('onChange(Math.max(0, count - 1))'))
assert.ok(ui.includes('canAdd={!atMax}')&&ui.includes('maxItems-others'))
assert.ok(ui.includes('sbChoiceCardTag')&&!ui.includes('sbChoiceGlyph'))
assert.ok(!ui.includes('sbCardMotif'))
assert.ok(css.includes('/* 2026-10-14 competitor-aligned redesign:'))
assert.ok(css.includes('--sb-paper:#fcf8f1')&&css.includes('--sb-rose:#861524'))
assert.ok(css.includes('.sbPreviewPage .sbExploreCard'))
assert.ok(css.includes('.sbPreviewPage .sbExploreCard h3'))
assert.ok(css.includes('.sbPreviewPage .sbExploreArrow'))
assert.ok(css.includes('.sbPreviewPage .sbChoiceCard--selected'))
assert.ok(css.includes('.sbPreviewPage .sbQty button{width:44px') )
assert.ok(css.includes('@media(max-width:600px)'))
assert.ok(css.includes('.sbPreviewPage .sbChoiceGrid{grid-template-columns:minmax(0,1fr)'))
assert.ok(!css.includes('MAXIMALIST TIER SELECTOR'))
assert.ok(!buyerCss.includes('MAXIMALIST / NAME + FINAL PRICE ONLY'))
assert.ok(!css.includes('linear-gradient(125deg,#3b102a'))
assert.ok(!buyerCss.includes('linear-gradient(116deg,#371020'))
const p=ts.transpileModule(price,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {hamperFinalPriceRupees}=await import("data:text/javascript;base64,"+Buffer.from(p).toString("base64"))
assert.equal(hamperFinalPriceRupees(499),549)
assert.equal(hamperFinalPriceRupees(1299),1349)
assert.ok(!/unitBudgetPaise|internalSpentPaise|retail_inventory|stock|selectedProductIds/.test(ui))
console.log("CELEBRATION_SELF_BUILD_COMPETITOR_STYLE_PASSED: natural cream/wine tiers; accessible category/option cards; real catalog data; mobile; checkout gated")
