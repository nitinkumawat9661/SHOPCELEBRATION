import { readFileSync } from "node:fs"
import assert from "node:assert/strict"

const page = readFileSync("app/admin/v3/page.tsx", "utf8")
const app = readFileSync("features/admin/v3/AdminDashboardV3.tsx", "utf8")
const style = readFileSync("styles/admin-v3.css", "utf8")

assert.match(page, /getAdminAccessState\(\)/, "Admin V3 must require existing auth state")
assert.match(page, /!access\.authenticated/, "Unauthenticated visitors must be gated")
assert.match(page, /AdminLogin/, "Reuse existing admin login")
assert.match(page, /!access\.passkeyEnabled/, "Reuse existing passkey bootstrap")
assert.match(page, /AdminPasskeySetup/, "Passkey setup must be available")
assert.match(page, /index: false/, "Admin V3 must be noindex")
assert.match(app, /\/api\/admin\/orders/, "Use current protected order data")
assert.match(app, /\/api\/admin\/analytics\?days=/, "Use verified analytics endpoint")
assert.match(app, /\/api\/catalog/, "Use live catalog, not unpublished draft")
assert.match(app, /read-only V3 preview/, "State clearly that the V3 surface is read-only")
assert.doesNotMatch(app, /\/api\/admin\/(?:inventory|catalog|campaigns|store-settings)["']\s*,\s*\{\s*method:\s*["'](?:POST|PATCH|PUT|DELETE)/,
  "Phase 1 must not mutate business records")
for (const view of ["overview", "orders", "products", "inventory", "hampers", "offers", "customers", "analytics", "reviews", "settings"]) {
  assert.match(app, new RegExp('id: "' + view + '"'), "V3 navigation missing " + view)
}
assert.match(style, /@media \(max-width:1023px\)/, "Responsive mobile shell missing")
assert.match(style, /cav3-bottom-nav/, "Mobile navigation missing")
assert.match(style, /cav3-sidebar/, "Desktop navigation missing")
assert.ok(!style.includes("body{") && !style.includes("html{"), "Keep V3 styles scoped")
console.log("PASS: Admin V3 phase-1 static safety checks (NOT a runtime/typecheck/browser test)")
