import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const read = path => readFileSync(path, "utf8")
for (const path of [
  "app/admin/v3/page.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "features/admin/v3/AdminOffersV3.tsx",
  "features/admin/AdminCampaigns.tsx"
]) {
  const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const errs = file.parseDiagnostics.map(err => ts.flattenDiagnosticMessageText(err.messageText, "\n"))
  assert.deepEqual(errs, [], "TypeScript / TSX parser errors in " + path)
}
const page = read("app/admin/v3/page.tsx")
const shell = read("features/admin/v3/AdminDashboardV3.tsx")
const overview = read("features/admin/v3/AdminOffersV3.tsx")
const legacy = read("features/admin/AdminCampaigns.tsx")
const api = read("app/api/admin/campaigns/route.ts")
const server = read("lib/server/campaigns.ts")
const css = read("styles/admin-v3-offers.css")

assert.match(page, /getAdminAccessState\(\)/, "Passkey-authenticated route must remain")
assert.match(page, /admin-v3-offers\.css/, "Offers stylesheet must be restricted to V3")
assert.match(shell, /<AdminOffersV3 onDirtyChange=\{setOffersDirty\}/, "V3 must mount guarded Offers")
assert.match(shell, /view === "offers" && offersDirty/, "Unsaved offers must block unintentional navigation / logout")
assert.match(overview, /<AdminCampaigns v3/, "Reuse operational editor")
assert.match(overview, /\/api\/admin\/campaigns/, "Overview uses protected campaign config")
assert.match(overview, /\/api\/admin\/analytics\?days=/, "Campaign metrics use verified paid-order analytics")
assert.match(overview, /No read-only quote simulator or archive feature has been implemented/, "Do not falsely advertise absent features")
assert.match(overview, /the entire cart subtotal/, "Existing all-cart product predicate must be disclosed")
assert.match(overview, /stats\.campaigns\.map/, "Campaign paid-order report must be based on recorded IDs")
assert.match(overview, /setStatsError\(/, "Failure must not report fake zero metrics")
assert.match(legacy, /v3 = false/, "Existing old Admin defaults untouched")
assert.match(legacy, /onDirtyChange\?\.\(dirty\)/, "Editor must report unsaved changes")
assert.match(legacy, /window\.addEventListener\("beforeunload"/, "Protect unsaved editor drafts")
assert.match(legacy, /REVIEW CAMPAIGN PUBLISH/, "Global live campaign publish must be confirmed")
assert.match(legacy, /expectedVersion: version/, "Preserve optimistic-version writes")
assert.match(legacy, /setDirty\(false\)/, "Successful publish resets dirty flag")
assert.match(legacy, /await load\(\)/, "Reload must call canonical server state")
assert.match(legacy, /const visible = useMemo\(/, "V3 browser filters only")
assert.match(legacy, /visible : config\.campaigns\.map/, "Old Admin still renders full campaign list")
assert.match(api, /isAdminRequest\(\)/, "Protected API")
assert.match(api, /enforceSameOrigin\(request\)/, "Writes restricted to same origin")
assert.match(api, /consumeRequestRateLimit/, "Writes rate-limited")
assert.match(api, /saveCampaignConfig\(body\.config, body\.expectedVersion\)/, "No duplicated discount engine")
assert.match(server, /CAMPAIGN_VERSION_CONFLICT/, "Server enforces version conflict")
assert.match(css, /@media\(max-width:600px\)/, "Mobile rules in V3 stylesheet")
assert.doesNotMatch(overview, /fetch\([^;]*method:\s*["'](?:PATCH|POST|PUT|DELETE)/s,
  "Offers overview is read-only; it delegates writes to the existing guarded editor")
console.log("PASS: Admin V3 Offers source-contract / TSX syntax checks")
console.log("NOTE: Not a DB integration, build, authentic browser or live checkout verification")
