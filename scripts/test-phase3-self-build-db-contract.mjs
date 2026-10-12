#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [base,ownerRates,categoryOnly,service,route,doc]=await Promise.all([
  "db/migrations/047_self_build_hamper_draft_architecture.sql",
  "db/migrations/048_self_build_owner_confirmed_categories_and_rates.sql",
  "db/migrations/049_self_build_category_only_no_sku_mapping.sql",
  "lib/server/self-build-admin.ts",
  "app/api/admin/self-build/route.ts",
  "docs/PHASE3_SELF_BUILD_DB_ARCHITECTURE_20261013.md"
].map(read))
for(const table of ["self_build_configuration","self_build_categories","self_build_options","self_build_drafts","self_build_order_snapshots"]) {
  assert(base.includes("CREATE TABLE "+table),"Expected staging table "+table)
}
assert.match(base,/customer_enabled boolean NOT NULL DEFAULT false CHECK \(customer_enabled = false\)/)
assert.match(base,/show_item_prices boolean NOT NULL DEFAULT false CHECK \(show_item_prices = false\)/)
assert(base.includes("'primary', 6000"),"Default private ₹60 budget")
assert(base.includes("'bangles', NULL, 'Bangles', NULL, 'catalog', 'per_unit', 15000"),"Retain bangles ₹150 seed")
const jewellery = [
  ["premium-feature-necklaces","Premium Feature Necklaces",6000],
  ["premium-necklaces","Premium Necklaces",6000],
  ["necklace-stud-sets","Necklace & Stud Sets",6000],
  ["korean-earrings","Korean Earrings",6000],
  ["indian-trending-earrings","Indian Trending Earrings",6000],
  ["minimal-rings","Minimal Rings",6000],
  ["viral-bangles","Viral Bangles",15000],
  ["korean-bangles","Korean Bangles",15000]
]
for(const [id,label,paise] of jewellery) {
  assert(ownerRates.includes("('"+id+"', 'jewellery', '"+label+"', NULL, 'catalog', 'per_unit', "+paise+","))
}
assert(ownerRates.includes("charge_mode = 'per_unit', unit_budget_paise = 5000"),"Photo cost must be ₹50 each")
assert(ownerRates.includes("unit_budget_paise = 60000"),"Large must consume ₹600")
assert(ownerRates.includes("label = 'Starter', unit_budget_paise = 10000, active = true"),"Starter must be ₹100")
assert(categoryOnly.includes("RAISE EXCEPTION 'SELF_BUILD_SKU_RULES_EXIST_REVIEW_BEFORE_REMOVAL'"),"Existing mapping guard must prevent data loss")
assert(categoryOnly.includes("RAISE EXCEPTION 'SELF_BUILD_CATALOG_CATEGORY_MAPPING_EXISTS_REVIEW_BEFORE_REMOVAL'"),"Existing catalogue category guard required")
assert(categoryOnly.includes("SET selection_kind = 'category'"),"Selectors now category-only")
assert(categoryOnly.includes("selection_kind = 'category' AND charge_mode = 'per_unit'"),"Category unit pricing must use admin DB field")
assert(categoryOnly.includes("DROP TABLE self_build_catalog_product_rules"),"Drop unused SKU mapping table")
assert(categoryOnly.includes("DROP COLUMN catalog_category"),"Remove SKU category coupling")
assert(categoryOnly.includes("SET version = version + 1"),"Bump optimistic admin config version")
assert(route.includes("await isAdminRequest()")&&route.includes("enforceSameOrigin(request)")&&route.includes("adminMutation"),"Admin security missing")
assert(route.includes("private, no-store") && !route.includes("export async function POST"),"No public order or cache of private amounts")
assert(!service.includes('getCatalogConfig'),"Must not use retail SKU catalogue in category-only flow")
assert(!service.includes('self_build_catalog_product_rules'),"No SKU mapping database dependency")
assert(!service.includes('productRules:') && !service.includes('catalogCategory:'),"No SKU fields in admin payload")
assert(service.includes('SKU_MAPPING_NOT_SUPPORTED'),"Reject old SKU mapping writes")
assert(service.includes('kind === "category" && mode === "per_unit" && unit !== null'),"Per-category editable budget required")
assert(service.includes("STALE_SELF_BUILD_CONFIGURATION")&&service.includes("FOR UPDATE"),"Admin version locking required")
assert(service.includes("CYCLIC_SELF_BUILD_CATEGORIES") && service.includes("OPTION_CATEGORY_NOT_VARIANT"))
assert(service.includes('v.customerEnabled !== false || v.showItemPrices !== false'),"Private prices + customer gate must stay disabled")
assert(doc.includes("No outstanding SKU mapping work."),"Documentation must clearly close SKU mapping")
console.log("Phase 3 final category-only model validated: 8 jewellery groups, private DB unit amounts, zero SKU mapping, per-photo ₹50 and disabled buyer flow.")
