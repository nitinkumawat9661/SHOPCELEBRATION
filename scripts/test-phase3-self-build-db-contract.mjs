#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [sql,service,route,doc]=await Promise.all([
 "db/migrations/047_self_build_hamper_draft_architecture.sql",
 "lib/server/self-build-admin.ts",
 "app/api/admin/self-build/route.ts",
 "docs/PHASE3_SELF_BUILD_DB_ARCHITECTURE_20261013.md"
].map(read))
const tables=["self_build_configuration","self_build_categories","self_build_options","self_build_catalog_product_rules","self_build_drafts","self_build_order_snapshots"]
for(const table of tables)assert(sql.includes("CREATE TABLE "+table),"Missing staged DB table: "+table)
assert.match(sql,/customer_enabled boolean NOT NULL DEFAULT false CHECK \(customer_enabled = false\)/)
assert.match(sql,/show_item_prices boolean NOT NULL DEFAULT false CHECK \(show_item_prices = false\)/)
assert(sql.includes("'primary', 6000"))
assert(sql.includes("'bangles', NULL, 'Bangles', NULL, 'catalog', 'per_unit', 15000"))
assert(sql.includes("'personalised-photos', NULL, 'Personalised Photos', NULL, 'photo', 'once_per_category', 5000"))
for(const category of ["chocolates","snacks","perfume"]){
 for(const [size,cost] of [["mini",20000],["medium",40000],["large",40000],["mega",100000]]){
   const pattern=new RegExp("'"+(category==="chocolates"?"chocolate":category==="snacks"?"snack":category)+"-"+size+"', '"+category+"', '[^']+', "+cost)
   assert.match(sql,pattern,"Missing "+category+" "+size+" internal budget")
 }
}
assert(sql.includes("'chocolate-extra-100', 'chocolates', 'Name pending owner confirmation', 10000, 10, false"))
assert(sql.includes("CREATE INDEX self_build_drafts_account_idx"))
assert(!sql.includes("INSERT INTO self_build_catalog_product_rules"),"Do not assume stylistic bangle SKU mappings")
assert(!sql.includes("INSERT INTO self_build_drafts"),"Do not manufacture drafts")
assert(route.includes("await isAdminRequest()")&&route.includes("enforceSameOrigin(request)")&&route.includes("adminMutation"),"Admin authorization/CSRF/rate limit required")
assert(route.includes("private, no-store"))
assert(!route.includes("export async function POST"),"Do not introduce live customer purchase operation")
assert(service.includes("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
assert(service.includes("FOR UPDATE")&&service.includes("STALE_SELF_BUILD_CONFIGURATION"))
assert(service.includes('data.customerEnabled !== false || data.showItemPrices !== false'))
assert(service.includes("UNKNOWN_CATALOG_PRODUCT"))
assert(service.includes("UNKNOWN_CATALOG_CATEGORY"))
assert(service.includes("OPTION_CATEGORY_NOT_VARIANT"))
assert(service.includes("PRODUCT_RULE_CATEGORY_NOT_CATALOG"))
assert(service.includes("CYCLIC_SELF_BUILD_CATEGORIES"))
assert(service.includes("DELETE FROM self_build_catalog_product_rules"))
assert(doc.includes("seven real Jewellery category names")&&doc.includes("Which exact SKU IDs"))
console.log("Phase 3 self-build DB architecture/source privacy contracts passed.")
