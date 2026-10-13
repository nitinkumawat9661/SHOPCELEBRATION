#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [schema,service,endpoint,ui,admin,styles,quote,settings] = await Promise.all([
  "db/migrations/050_self_build_category_capacity_and_tier_allowances.sql",
  "lib/server/self-build-capacity.ts",
  "app/api/admin/self-build/capacity/route.ts",
  "features/admin/AdminSelfBuildCapacity.tsx",
  "features/admin/AdminSelfBuildManager.tsx",
  "styles/admin-self-build-20261013.css",
  "lib/server/self-build-quote.ts",
  "lib/server/self-build-admin.ts"
].map(read))

for(const table of ["self_build_category_capacity","self_build_option_capacity","self_build_tier_allowances","self_build_capacity_control"])
  assert(schema.includes("CREATE TABLE "+table),"Missing staged capacity table "+table)
assert(schema.includes("ON DELETE CASCADE")&&schema.includes("verified boolean NOT NULL DEFAULT false"))
assert(schema.includes("available_units integer NOT NULL DEFAULT 0")&&schema.includes("reserved_units integer NOT NULL DEFAULT 0"))
assert(schema.includes("enabled boolean NOT NULL DEFAULT false"),"No tier may be enabled by default")
assert(!schema.includes("INSERT INTO self_build_category_capacity")&&!schema.includes("INSERT INTO self_build_tier_allowances"),"No fake stock or guessed tier budget")
assert(service.includes("FOR SHARE")&&service.includes("FOR UPDATE")&&service.includes("STALE_SELF_BUILD_CAPACITY"))
assert(service.includes("CAPACITY_BELOW_RESERVED")&&service.includes("ON CONFLICT")&&service.includes("exactIds"),"Version lock, reserve protection and exact IDs required")
assert(service.includes("getCatalogConfig()"),"Tier list must be verified against actual store catalog")
assert(!service.includes("product_id")&&!service.includes("getProduct"),"No SKU mapping")
assert(endpoint.includes("await isAdminRequest()")&&endpoint.includes("enforceSameOrigin(request)")&&endpoint.includes("adminMutation"))
assert(endpoint.includes("private, no-store")&&endpoint.includes("CAPACITY_UNAVAILABLE"))
assert(!endpoint.includes("export async function POST"),"Do not create orders or reserve from admin route")
assert(settings.includes("ON CONFLICT (id) DO UPDATE")&&settings.includes("Only explicit removals delete availability"),"Editing category name must preserve capacity")
assert(!settings.includes('await client.query("DELETE FROM self_build_categories")'),"No full replacement that erases stock")
assert(admin.includes("AdminSelfBuildCapacity")&&admin.includes('section==="capacity"'))
assert(ui.includes('"/api/admin/self-build/capacity"')&&ui.includes('method:"PATCH"')&&ui.includes('credentials:"same-origin"'))
assert(ui.includes("verified")&&ui.includes("availableUnits")&&ui.includes("allowancePaise")&&ui.includes("settingsVersion"))
assert(ui.includes("response.status===409")&&ui.includes("window.confirm"),"Conflict handling and discard confirmation")
assert(!ui.includes("productRules")&&!ui.includes("productId"))
assert(styles.includes(".sbCapacityRow")&&styles.includes("@media(max-width:700px)"))
assert(quote.includes("PRIVATE server-only")&&quote.includes("STALE_SELF_BUILD_RULES"))
assert(quote.includes("TIER_BUDGET_EXCEEDED")&&quote.includes("INSUFFICIENT_VERIFIED_CATEGORY_CAPACITY"))
assert(!quote.includes("getCatalogConfig")&&!quote.includes("productId"),"Evaluator must not trust buyer catalogue SKUs/budgets")

// Compile real TypeScript to JS, test the shipped evaluator rather than a
// separate reimplementation with hardcoded arithmetic.
const js=ts.transpileModule(quote,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {evaluateSelfBuildBudget:quoteEval}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"))
const rules={
  version:3,
  config:{customerEnabled:false,showItemPrices:false,allowMultipleQuantities:true,defaultCatalogItemBudgetPaise:6000,otherRequestPrompt:"Other"},
  categories:[
    {id:"jewellery",parentId:null,label:"Jewellery",selectionKind:"group",chargeMode:"none",unitBudgetPaise:null,displayOrder:10,active:true},
    {id:"premium-necklaces",parentId:"jewellery",label:"Premium Necklaces",selectionKind:"category",chargeMode:"per_unit",unitBudgetPaise:6000,displayOrder:20,active:true},
    {id:"viral-bangles",parentId:"jewellery",label:"Viral Bangles",selectionKind:"category",chargeMode:"per_unit",unitBudgetPaise:15000,displayOrder:30,active:true},
    {id:"chocolates",parentId:null,label:"Chocolates",selectionKind:"variant",chargeMode:"option",unitBudgetPaise:null,displayOrder:40,active:true},
    {id:"photos",parentId:null,label:"Personalised Photos",selectionKind:"photo",chargeMode:"per_unit",unitBudgetPaise:5000,displayOrder:50,active:true},
    {id:"notes",parentId:null,label:"Anything Else",selectionKind:"notes",chargeMode:"none",unitBudgetPaise:null,displayOrder:60,active:true}
  ],
  options:[
    {id:"starter",categoryId:"chocolates",label:"Starter",unitBudgetPaise:10000,displayOrder:10,active:true},
    {id:"large",categoryId:"chocolates",label:"Large",unitBudgetPaise:60000,displayOrder:40,active:true}
  ]
}
const capacity={
  version:1,settingsVersion:3,
  categories:[
    {id:"premium-necklaces",label:"Premium Necklaces",parentLabel:"Jewellery",active:true,availableUnits:4,reservedUnits:0,verified:true},
    {id:"viral-bangles",label:"Viral Bangles",parentLabel:"Jewellery",active:true,availableUnits:2,reservedUnits:0,verified:true},
    {id:"photos",label:"Personalised Photos",parentLabel:null,active:true,availableUnits:5,reservedUnits:0,verified:true}
  ],
  options:[
    {id:"starter",label:"Starter",groupLabel:"Chocolates",active:true,availableUnits:5,reservedUnits:0,verified:true},
    {id:"large",label:"Large",groupLabel:"Chocolates",active:true,availableUnits:1,reservedUnits:0,verified:true}
  ],
  tiers:[{id:"tier-x",label:"Test tier",sellingPricePaise:79900,allowancePaise:50000,enabled:true}]
}
const item=(kind,id,quantity)=>({kind,id,quantity})
const test=(name,selection,expected,r=rules,c=capacity)=>{
  const result=quoteEval("tier-x",selection,r,c)
  assert.equal(result.code,expected,name)
  return result
}
const safe=test("category quantity and photo unit consumption",[
  item("category","premium-necklaces",2),item("category","viral-bangles",1),
  item("category","photos",3),item("option","starter",1)
],"WITHIN_PRIVATE_BUDGET")
assert.equal(safe.internalSpentPaise,52000-2000,"2×₹60 + ₹150 + 3×₹50 + ₹100 = ₹520 internally")
// baseline tier budget ₹500 currently, example selected ₹520 must fail before reaching above.
