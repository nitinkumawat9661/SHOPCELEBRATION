#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [base,revision,service,route,doc]=await Promise.all([
 "db/migrations/047_self_build_hamper_draft_architecture.sql",
 "db/migrations/048_self_build_owner_confirmed_categories_and_rates.sql",
 "lib/server/self-build-admin.ts",
 "app/api/admin/self-build/route.ts",
 "docs/PHASE3_SELF_BUILD_DB_ARCHITECTURE_20261013.md"
].map(read))
for (const table of ["self_build_configuration","self_build_categories","self_build_options","self_build_catalog_product_rules","self_build_drafts","self_build_order_snapshots"]) {
  assert(base.includes("CREATE TABLE "+table),"Missing staging table "+table)
}
assert.match(base,/customer_enabled boolean NOT NULL DEFAULT false CHECK \(customer_enabled = false\)/)
assert.match(base,/show_item_prices boolean NOT NULL DEFAULT false CHECK \(show_item_prices = false\)/)
assert(base.includes("'primary', 6000"))
assert(base.includes("'bangles', NULL, 'Bangles', NULL, 'catalog', 'per_unit', 15000"))
assert(base.includes("CREATE INDEX self_build_drafts_account_idx"))
assert(!base.includes("INSERT INTO self_build_catalog_product_rules"),"No guessed bangle SKU assignment")
assert(!revision.includes("INSERT INTO self_build_catalog_product_rules"),"No guessed owner SKU assignment in amendment")
assert(!base.includes("INSERT INTO self_build_drafts"),"Do not invent account drafts")
assert(revision.includes("DROP CONSTRAINT self_build_categories_charge_semantics"),"Existing PostgreSQL CHECK must be migrated")
assert(revision.includes("selection_kind = 'photo' AND charge_mode IN ('per_unit','once_per_category')"))
assert(revision.includes("charge_mode = 'per_unit', unit_budget_paise = 5000"),"Photos must consume ₹50 each, not once")
const categoryRows=[
 ["premium-feature-necklaces","Premium Feature Necklaces",6000],
 ["premium-necklaces","Premium Necklaces",6000],
 ["necklace-stud-sets","Necklace & Stud Sets",6000],
 ["korean-earrings","Korean Earrings",6000],
 ["indian-trending-earrings","Indian Trending Earrings",6000],
 ["minimal-rings","Minimal Rings",6000],
 ["viral-bangles","Viral Bangles",15000],
 ["korean-bangles","Korean Bangles",15000]
]
for (const [id,label,amount] of categoryRows) {
 assert(revision.includes("('"+id+"', 'jewellery', '"+label+"', NULL, 'catalog', 'per_unit', "+amount+","),"Owner's category is missing or mispriced: "+id)
}
assert(revision.includes("WHERE id IN ('chocolate-large', 'snack-large', 'perfume-large')"),"All three Large rates must be updated")
assert(revision.includes("unit_budget_paise = 60000"),"Large must be ₹600")
assert(revision.includes("label = 'Starter', unit_budget_paise = 10000, active = true"),"Chocolate Starter ₹100 must be enabled")
assert(revision.includes("SET version = version + 1"),"Concurrent admin edits must be invalidated")
assert(route.includes("await isAdminRequest()")&&route.includes("enforceSameOrigin(request)")&&route.includes("adminMutation"),"Admin authentication/CSRF/rate limit required")
assert(route.includes("private, no-store"))
assert(!route.includes("export async function POST"),"No customer self-build checkout until stock booking exists")
assert(service.includes("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
assert(service.includes("FOR UPDATE")&&service.includes("STALE_SELF_BUILD_CONFIGURATION"))
assert(service.includes("data.customerEnabled !== false || data.showItemPrices !== false"))
assert(service.includes("UNKNOWN_CATALOG_PRODUCT"))
assert(service.includes("UNKNOWN_CATALOG_CATEGORY"))
assert(service.includes("OPTION_CATEGORY_NOT_VARIANT"))
assert(service.includes("PRODUCT_RULE_CATEGORY_NOT_CATALOG"))
assert(service.includes("CYCLIC_SELF_BUILD_CATEGORIES"))
assert(service.includes('(mode === "per_unit" || mode === "once_per_category")'),"Admin must accept per-photo quantity consumption")
assert(service.includes("DELETE FROM self_build_catalog_product_rules"))
assert(doc.includes("Premium Feature Necklaces")&&doc.includes("Korean Bangles"),"Confirmed eight categories must be documented")
assert(doc.includes("₹50 per photo"),"Per-photo semantics must be documented")
console.log("Phase 3 owner-confirmed self-build DB contracts passed: 8 dynamic jewellery categories, per-photo ₹50, Large ₹600, Chocolate Starter ₹100, private admin-only staging.")
