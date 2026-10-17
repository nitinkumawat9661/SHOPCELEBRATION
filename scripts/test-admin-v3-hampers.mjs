import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const source = path => readFileSync(path, "utf8")
for (const path of [
  "features/admin/v3/AdminDashboardV3.tsx",
  "features/admin/v3/AdminHampersV3.tsx",
  "features/admin/AdminCatalogManager.tsx",
  "features/admin/AdminSelfBuildManager.tsx",
  "features/admin/AdminSelfBuildCapacity.tsx",
  "app/admin/v3/page.tsx"
]) {
  const parsed=ts.createSourceFile(path,source(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  assert.deepEqual(parsed.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n")),
    [],"Syntax error: "+path)
}

const workspace=source("features/admin/v3/AdminDashboardV3.tsx")
const screen=source("features/admin/v3/AdminHampersV3.tsx")
const catalog=source("features/admin/AdminCatalogManager.tsx")
const selfBuild=source("features/admin/AdminSelfBuildManager.tsx")
const capacity=source("features/admin/AdminSelfBuildCapacity.tsx")
const config=source("lib/server/self-build-admin.ts")
const selfBuildRoute=source("app/api/admin/self-build/route.ts")
const capacityRoute=source("app/api/admin/self-build/capacity/route.ts")
const paymentReview=source("features/admin/AdminSelfBuildPaymentReviews.tsx")
const css=source("styles/admin-v3-hampers.css")
const page=source("app/admin/v3/page.tsx")

assert.match(page,/getAdminAccessState\(\)/,"V3 must be passkey protected")
assert.match(page,/admin-self-build-20261013\.css/,"Self-Build existing styles must remain loaded")
assert.match(page,/admin-v3-hampers\.css/,"Dedicated responsive V3 hamper styles required")
assert.match(workspace,/<AdminHampersV3/,"Hampers tab must load real operational UI")
assert.match(workspace,/onDirtyChange=\{setHamperDirty\}/,"Navigation must know about unsaved changes")
assert.match(workspace,/view === "hampers" && hamperDirty/,"Navigation should confirm unsaved edits")
assert.match(screen,/AdminCatalogManager section="tiers" reviewGlobalPublish/,"Curated tiers reuse safeguarded catalog editor")
assert.match(screen,/AdminCatalogManager section="occasions" reviewGlobalPublish/,"Occasions use shared catalog editor")
assert.match(screen,/AdminSelfBuildManager onDirtyChange=\{setDirty\}/,"Self-Build editor must report unsaved state")
assert.match(screen,/AdminCustomRequests/,"Preserve custom enquiry flow")
assert.match(screen,/AdminSelfBuildPaymentReviews/,"Preserve manual payment reconciliation")
assert.match(screen,/Customer Self-Build checkout remains/, "Disabled checkout must be explicit")
assert.match(screen,/private per-item costs never appear publicly/, "Keep private cost disclosure warning")
assert.match(catalog,/reviewGlobalPublish = false/, "Existing admin catalog editor behavior must stay default")
assert.match(catalog,/const reviewMode = focusMode \|\| reviewGlobalPublish/,"Enable global review for V3 hamper settings")
assert.match(catalog,/REVIEW GLOBAL CATALOG PUBLISH/,"Always confirm whole-catalog publish")
assert.match(catalog,/ensureFocusedDraftFresh\(\)/,"Recheck version and draft recency before V3 save")
assert.match(catalog,/productIds, tierIds/,"Whole-catalog impact report must include products and tiers")
assert.match(selfBuild,/onDirtyChange\?: \(dirty: boolean\) => void/,"Existing Self-Build gets optional callback")
assert.match(selfBuild,/const unsaved = dirty \|\| invalidDraftInput \|\| capacityDirty/,"Track unsaved invalid inputs and capacity")
assert.match(selfBuild,/selectSection\(next:Group\)/,"Switching Self-Build tabs must warn")
assert.match(selfBuild,/AdminSelfBuildCapacity onDirtyChange=\{setCapacityDirty\}/,"Nested capacity changes must be guarded")
assert.match(capacity,/const invalidInput =/,"Even invalid field content is unsaved")
assert.match(capacity,/onDirtyChange\?\.\(dirty \|\| invalidInput\)/,"Report nested dirty state")
assert.match(config,/customerEnabled: false/,"Backend forbids customer checkout")
assert.match(config,/showItemPrices: false/,"Backend forbids customer-facing private prices")
assert.match(config,/SKU_MAPPING_NOT_SUPPORTED/,"Do not silently map categories to SKUs")
for (const route of [selfBuildRoute, capacityRoute]) {
  assert.match(route,/isAdminRequest\(\)/,"All Self-Build config API routes require admin auth")
  assert.match(route,/enforceSameOrigin\(request\)/,"Self-Build mutations must enforce origin")
}
assert.match(paymentReview,/does NOT move money/,"Refund reference must never claim to issue refund")
assert.match(css,/@media\(max-width:600px\)/,"Hampers mobile styles required")
console.log("PASS: Hampers V3 source contracts (syntax, auth, global publish, Self-Build safety, unsaved edits).")
console.log("NOTE: This script is NOT a DB/Next build/browser test.")
