import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import ts from "typescript"

const files = [
  "app/admin/v3/page.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "features/admin/v3/AdminDetailsV3.tsx"
]

const source = Object.fromEntries(files.map(path => [path, readFileSync(path, "utf8")]))
for (const [path, value] of Object.entries(source)) {
  const parsed = ts.createSourceFile(path, value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const failures = parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
  assert.deepEqual(failures, [], "TypeScript JSX parse failed in " + path)
}

const route = source["app/admin/v3/page.tsx"]
const workspace = source["features/admin/v3/AdminDashboardV3.tsx"]
const detail = source["features/admin/v3/AdminDetailsV3.tsx"]
const css = readFileSync("styles/admin-v3-details.css", "utf8")

assert.match(route, /getAdminAccessState\(\)/, "Auth must still be gated")
assert.match(route, /!access\.authenticated/, "Unauthenticated route must remain blocked")
assert.match(route, /!access\.passkeyEnabled/, "Passkey setup guard must be preserved")
assert.match(route, /robots:\s*\{\s*index:\s*false/, "Noindex must be maintained")
assert.match(route, /admin-v3-details\.css/, "Detail styling must be route-scoped")
assert.match(workspace, /AdminProductDetailV3/, "Product details must be integrated")
assert.match(workspace, /AdminOrderDetailV3/, "Order details must be integrated")
assert.match(workspace, /role="button" tabIndex=\{0\}/, "Read-only lists must be keyboard navigable")
assert.match(workspace, /event\.key === "Enter"/, "Keyboard activation on item rows")
assert.match(detail, /productImages\(product\)/, "Product gallery must be exact SKU")
assert.match(detail, /order\.lineItems/, "Order must use saved purchased item snapshots")
assert.match(detail, /order\.amountPaise/, "Order total must use historical recorded amount")
assert.match(detail, /customerPaymentStatusLabel\(order\.paymentStatus\)/, "Payment status must remain distinct")
assert.match(detail, /AWB booking alone does not establish courier pickup/, "No invented shipment movement")
assert.match(detail, /recorded snapshots/, "Historical details must be correctly labeled")
assert.match(css, /cav3-detail-columns/, "Responsive detail layout must exist")
assert.match(css, /max-width:500px/, "Mobile detail layout must exist")

for (const f of [workspace, detail]) {
  assert.doesNotMatch(f, /fetch\([^)]*\{[^}]*method:\s*["'](?:POST|PUT|PATCH|DELETE)/,
    "V3 detail/read-only UI must not add business mutation fetches")
}
console.log("PASS: V3 phase-2 AST parsing and focused static safety checks (NOT build/runtime integration)")
