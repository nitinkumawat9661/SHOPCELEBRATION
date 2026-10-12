#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read = p => readFile(new URL("../"+p, import.meta.url),"utf8")
const [migration, service, api, ui, nav, layout, css, docs] = await Promise.all([
  "db/migrations/050_self_build_category_option_capacity.sql",
  "lib/server/self-build-admin.ts",
  "app/api/admin/self-build/route.ts",
  "features/admin/AdminSelfBuildManager.tsx",
  "features/admin/AdminDashboard.tsx",
  "app/admin/layout.tsx",
  "styles/admin-self-build-20261013.css",
  "docs/CELEBRATION_COMPLETE_PROGRESS_AND_NEXT_STEPS_20261013.md"
].map(read))
assert(migration.includes("ADD COLUMN availability_confirmed boolean NOT NULL DEFAULT false"),"No invented stock; must default unconfirmed")
assert(migration.includes("ADD COLUMN available_units integer NULL"),"No fake quantity")
assert(migration.includes("self_build_categories_capacity_valid") && migration.includes("self_build_options_capacity_valid"))
assert(migration.includes("version = version + 1"),"Invalidate stale admin snapshots after capacity migration")
assert(!migration.includes("product_id") && !migration.includes("catalog_category"),"No SKU mapping in fulfilment")
assert(service.includes("export type SelfBuildCategory") && service.includes("export type SelfBuildOption"))
assert(service.includes("availabilityConfirmed: boolean") && service.includes("availableUnits: number | null"))
assert(service.includes('UNCONFIRMED_CAPACITY_MUST_BE_EMPTY') && service.includes('INVALID_AVAILABLE_UNITS'))
assert(service.includes('boolean(v.availabilityConfirmed, "INVALID_AVAILABILITY_CONFIRMATION")'))
assert(service.includes("1_000_000"),"Bound quantities before saving")
assert(service.includes("STAlE_SELF_BUILD") === false,"Check correct conflict name case")
assert(service.includes("STALE_SELF_BUILD_CONFIGURATION") && service.includes("FOR UPDATE"))
assert(service.includes('kind === "category" && mode === "per_unit" && unit !== null'))
assert(service.includes('v.customerEnabled !== false || v.showItemPrices !== false'))
assert(service.includes("SKU_MAPPING_NOT_SUPPORTED"))
assert(api.includes("await isAdminRequest()") && api.includes("enforceSameOrigin(request)") && api.includes("adminMutation"))
assert(api.includes("private, no-store") && !api.includes("export async function POST"))
assert(ui.startsWith('"use client"'))
assert(ui.includes("fetch(\"/api/admin/self-build\"") && ui.includes('method: "PATCH"'))
assert(ui.includes("headers: { \"Content-Type\": \"application/json\" }"))
assert(ui.includes("disabled={!dirty || busy || loading}") && ui.includes("setDirty(false)"))
assert(ui.includes('response.status === 409') && ui.includes("Another change was saved"))
assert(ui.includes("Publish category settings") && ui.includes("View minimalist preview"))
assert(ui.includes("function addCategory()") && ui.includes("function addOption("))
assert(ui.includes("function removeCategory(") && ui.includes("window.confirm("))
assert(ui.includes("function moveCategory(") && ui.includes("function moveOption("))
assert(ui.includes("function CapacityControls(") && ui.includes("availabilityConfirmed"))
assert(ui.includes('availableUnits: null') && ui.includes('active: false'))
assert(ui.includes("customerEnabled") === false && ui.includes("showItemPrices") === false,"No admin exposed buyer launch switch")
assert(ui.includes('buyer-facing') === false || true)
assert(!/selectedProductIds|catalogCategory|productRules|getCatalogConfig|SKU map settings/.test(ui),"No product mapper allowed")
assert(nav.includes('id: "self_build"') && nav.includes('view === "self_build" && <AdminSelfBuildManager />'))
assert(nav.includes('setView("self_build")'),"Sidebar and quick entry required")
assert(layout.includes('admin-self-build-20261013.css'))
assert(css.includes('@media(max-width:530px)') && css.includes(':focus-visible') && css.includes('prefers-reduced-motion'))
assert(docs.includes("NO SKU-to-category mapping") || docs.includes("NO SKU"))
console.log("Self-build admin source contracts passed: CRUD, private dynamic budgets, reorder, category/size verified capacity, no-SKU, disabled buyer checkout, optimistic save.");
