#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [ui,dashboard,css,route,server,doc]=await Promise.all([
 "features/admin/AdminSelfBuildManager.tsx","features/admin/AdminDashboard.tsx",
 "styles/admin-self-build-20261013.css","app/api/admin/self-build/route.ts",
 "lib/server/self-build-admin.ts","docs/CELEBRATION_COMPLETE_PROGRESS_AND_NEXT_STEPS_20261013.md"
].map(read))
assert(ui.startsWith('"use client"'))
assert(ui.includes('"/api/admin/self-build"')&&ui.includes('method:"PATCH"'),"Uses existing private DB admin API")
assert(ui.includes('credentials:"same-origin"')&&ui.includes('cache: "no-store"'),"Authenticated fresh reads required")
assert(ui.includes('body:JSON.stringify(state)')&&ui.includes('JSON.stringify(next)'),"Admin writes and server response versions must be persisted")
assert(ui.includes('response.status===409')&&ui.includes('Reload current settings'),"Stale admin version conflict handled")
assert(ui.includes('const dirty = ')&&ui.includes('!dirty'),"No unmodified writes")
assert(ui.includes('window.confirm')&&ui.includes('Discard changes'),"Explicit destructive-change protection")
assert(ui.includes('setEditingAmounts')&&ui.includes('parseRupees(raw)'),"Parse editable internal rupee amounts to paise")
assert(ui.includes('key==="default"'),"Validate pending invalid default budget")
assert(ui.includes('state.categories.map(')&&ui.includes('state.options.map('),"DB-powered categories/options, not hardcoded arrays")
assert(ui.includes('newParent')&&ui.includes('newKind')&&ui.includes('addCategory()'),"Dynamic category tree creation required")
assert(ui.includes('addOption()')&&ui.includes('removeOption('),"Dynamic variant options editing required")
assert(ui.includes('unitBudgetPaise')&&ui.includes('displayOrder')&&ui.includes('checked={category.active}')&&ui.includes('checked={option.active}'),"Budget, display order, active status")
assert(ui.includes('otherRequestPrompt')&&ui.includes('allowMultipleQuantities'),"Global settings editable")
assert(ui.includes('self-build-preview')&&ui.includes('Customer orders are disabled.'),"Owner preview link and staging notice")
assert(!ui.includes('productRules')&&!ui.includes('catalogCategory')&&!ui.includes('productId'),"No retail SKU mapping")
assert(!ui.includes('/api/orders')&&!ui.includes('/api/payment'),"No buyer checkout")
assert(dashboard.includes('id: "selfBuild"')&&dashboard.includes('<AdminSelfBuildManager />') && dashboard.includes('<AdminSelfBuildPaymentReviews />'),"Main admin page must render editor")
assert(dashboard.includes('label: "Self-Build Studio"')&&dashboard.includes('setView("selfBuild")'),"Desktop/mobile navigation and quick action")
assert(dashboard.includes('admin-self-build-20261013.css'),"Scoped stylesheet loaded")
assert(css.includes('.sbAdmin{')&&css.includes('@media(max-width:430px)')&&css.includes(':focus-visible'))
assert(route.includes('await isAdminRequest()')&&route.includes('enforceSameOrigin(request)')&&route.includes('adminMutation'),"Admin endpoint authorization and CSRF")
assert(route.includes('private, no-store'),"No caching of admin costs")
assert(server.includes('FOR UPDATE')&&server.includes('STALE_SELF_BUILD_CONFIGURATION'),"Atomic/version-controlled admin edits")
assert(server.includes('SKU_MAPPING_NOT_SUPPORTED')&&server.includes('customerEnabled !== false'),"No SKU or premature checkout")
assert(doc.includes('Admin category controls'),"Master roadmap retained")
console.log("Phase 3 admin Self-Build Studio source contracts passed: private rates, category/option/prompt editing, version conflicts, responsive UI and disabled customer checkout.")
