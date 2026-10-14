#!/usr/bin/env node
// No DB, payment, inventory, R2 or production writes: group the actual public
// category tree. Previously indistinguishable Mini/Medium labels must be
// separated under their Chocolate/Snack/Perfume sections.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const paths=["lib/domain/self-build-choice-sections.ts",
  "features/builder/SelfBuildDesignPreview.tsx",
  "features/builder/CustomerSelfBuildStudio.tsx",
  "config/self-build-delivery.ts",
  "lib/server/orders/self-build-no-inventory.ts",
  "app/self-build/page.tsx"]
const [helper,preview,buyer,pricing,orders,launchGate]=await Promise.all(paths.map(read))
const code=ts.transpileModule(helper,{fileName:"self-build-choice-sections.ts",reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
assert.equal(code.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0)
const {buildSelfBuildGiftSections}=await import("data:text/javascript;base64,"+Buffer.from(code.outputText).toString("base64"))
const cat=(id,label,selectionKind,displayOrder,parentId=null)=>({id,label,selectionKind,displayOrder,parentId})
const opt=(id,categoryId,label,displayOrder)=>({id,categoryId,label,displayOrder})
const fixture={categories:[
 cat("jewellery","Jewellery","group",1),cat("necklace","Premium Necklace","category",3,"jewellery"),
 cat("korean-bangles","Korean Bangles","category",4,"jewellery"),
 cat("bangles","Bangles","category",8),
 cat("teddys","Teddys","group",4),cat("small-teddy","Small Teddy","category",10,"teddys"),
 cat("large-teddy","Large Teddy","category",20,"teddys"),
 cat("chocolates","Chocolates","variant",2),cat("snacks","Snacks","variant",3),
 cat("perfume","Perfume","variant",5),cat("photo","Personalised Photos","photo",6),
 cat("instructions","Personalisation Note","notes",7)
],options:[
 opt("choco-mini","chocolates","Mini",1),opt("choco-mega","chocolates","Mega",2),
 opt("snack-mini","snacks","Mini",1),opt("snack-mega","snacks","Mega",2),
 opt("perfume-mini","perfume","Mini",1)
],requestPrompt:"Anything else?"}
const groups=buildSelfBuildGiftSections(fixture)
assert.deepEqual(groups.map(g=>g.label),["Jewellery","Chocolates","Snacks","Teddys","Perfume","Personalised Photos"])
const byName=Object.fromEntries(groups.map(g=>[g.label,g]))
assert.deepEqual(byName.Jewellery.choices.map(c=>c.label),["Premium Necklace","Korean Bangles"])
assert.ok(!byName.Bangles,"Duplicate standalone Bangles is hidden when Jewellery already offers Bangles")
const noJewelleryBangles={
 ...fixture,categories:fixture.categories.filter(c=>c.id!=="korean-bangles")
}
assert.ok(buildSelfBuildGiftSections(noJewelleryBangles).some(s=>s.id==="bangles"),
 "Standalone Bangles must remain discoverable if Jewellery no longer offers any bangles")
assert.deepEqual(byName.Chocolates.choices.map(c=>c.key),["option:choco-mini","option:choco-mega"])
assert.deepEqual(byName.Snacks.choices.map(c=>c.key),["option:snack-mini","option:snack-mega"])
assert.deepEqual(byName.Teddys.choices.map(c=>c.label),["Small Teddy","Large Teddy"])
assert.deepEqual(byName.Perfume.choices.map(c=>c.label),["Mini"])
assert.deepEqual(byName["Personalised Photos"].choices.map(c=>c.key),["category:photo"])
const all=groups.flatMap(g=>g.choices.map(c=>c.key))
assert.equal(all.length,new Set(all).size,"No duplicated category/option in group projection")
assert.equal(all.length,10,"All real selectable options remain available regardless of tier")
assert.ok(!/unitBudgetPaise|salePricePaise|retail_inventory/.test(helper),
  "Only public labels & quantity keys may be used")
assert.ok(!preview.includes('step==="categories"')&&preview.includes('step==="choose"'))
assert.ok(!preview.includes('className="sbCategoryJump"')&&preview.includes('sbGiftSectionHeading'))
assert.ok(preview.includes('section.choices.map(choice=>'))
assert.ok(!buyer.includes('buyerStep==="categories"')&&!buyer.includes('sbBuyerCategoryList'))
assert.ok(buyer.includes('visibleSections.map(section=>')&&buyer.includes('section.choices.map(item=>'))
assert.ok(!preview.includes("MAXIMUM PIECES")&&!buyer.includes("TOTAL PIECES IN YOUR HAMPER"))
assert.ok(preview.includes("maxItems-others")&&buyer.includes("selectedUnits>=maxUnits"))
assert.ok(pricing.includes("HAMPER_DELIVERY_FEE_PAISE = SELF_BUILD_DELIVERY_FEE_PAISE"))
assert.ok(orders.includes("getSelfBuildTierLimits(chosenTier)"))
assert.ok(launchGate.includes("customerSelfBuildEnabled().catch(()=>false)"))
console.log("SELF_BUILD_INLINE_CATEGORY_GROUPS_PASSED: Jewellery, Chocolates, Snacks, Teddys separated; no duplicate standalone Bangles; tier pricing and stock untouched")
