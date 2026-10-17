import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const source = (path) => readFileSync(path, "utf8")
const domainPath = "lib/domain/admin-stock-adjustment.ts"
const transpiled = ts.transpileModule(source(domainPath), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
})
const { nextAvailableStock } = await import(
  "data:text/javascript;base64," + Buffer.from(transpiled.outputText).toString("base64")
)

assert.equal(nextAvailableStock(5, "add", 3), 8)
assert.equal(nextAvailableStock(5, "remove", 3), 2)
assert.equal(nextAvailableStock(5, "set", 3), 3)
assert.equal(nextAvailableStock(5, "set", 0), 0)
assert.equal(nextAvailableStock(0, "add", 1), 1)
assert.equal(nextAvailableStock(10000, "remove", 10000), 0)
for (const args of [[5, "remove", 6], [10000, "add", 1], [1, "set", 10001],
  [0, "remove", 1], [5, "set", 5], [5, "add", 0], [5, "remove", 0],
  [-1, "add", 2], [1.5, "add", 1], [5, "invalid", 1]]) {
  assert.throws(() => nextAvailableStock(...args))
}

const paths = [
  "features/admin/v3/AdminInventoryV3.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "lib/server/admin-inventory-adjustments.ts",
  "app/api/admin/inventory/adjustments/route.ts",
  "app/admin/v3/page.tsx"
]
for (const path of paths) {
  const parsed = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const errors = parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
  assert.deepEqual(errors, [], "TypeScript/TSX syntax error in " + path)
}
const ui = source(paths[0])
const workspace = source(paths[1])
const server = source(paths[2])
const route = source(paths[3])
const page = source(paths[4])
const migration = source("db/migrations/109_admin_inventory_adjustment_history.sql")
const oldReservations = source("lib/server/inventory.ts")

assert.match(workspace, /<AdminInventoryV3/, "Inventory V3 must appear in navigation")
assert.match(page, /admin-v3-inventory\.css/, "Inventory CSS should only load in V3 admin")
assert.match(route, /isAdminRequest\(\)/, "Both API methods require verified admin")
assert.match(route, /enforceSameOrigin\(request\)/, "All inventory writes need same-origin checks")
assert.match(route, /consumeRequestRateLimit/, "Admin inventory writes need rate limit")
assert.match(route, /applyAdminInventoryAdjustment/, "API must use transactional server function")
assert.match(route, /Cache-Control.*no-store/, "Financial/admin data must not be cached")
assert.match(server, /transaction\(async \(client\)/, "Adjustment must be transactional")
assert.match(server, /pg_advisory_xact_lock/, "Idempotent requests must be serialized")
assert.match(server, /request_id = \$1::uuid/, "Idempotent requests must be checked")
assert.match(server, /FOR SHARE/, "Catalog must not change under a stock adjustment")
assert.match(server, /FOR UPDATE/, "Available stock must be locked against checkout")
assert.match(server, /previous !== expected/, "Expected stock must reject stale adjustments")
assert.match(server, /nextAvailableStock\(previous, mode, value\)/, "Server must enforce pure quantity rules")
assert.match(server, /INSERT INTO admin_inventory_adjustments/, "Audit must be written in transaction")
assert.match(server, /invalidatePublicSnapshot\("catalog"\)/, "Public stock cache must be refreshed")
assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_inventory_adjustments/, "Additive history schema required")
assert.match(migration, /request_id uuid NOT NULL UNIQUE/, "Enforce unique idempotency key")
assert.doesNotMatch(migration, /DROP TABLE|ALTER TABLE product_inventory|UPDATE inventory_reservations/i,
  "Migration must not overwrite existing checkout inventory or reservation data")
assert.match(ui, /crypto\.randomUUID\(\)/, "Client must create idempotency key")
assert.match(ui, /expectedAvailable: previous/, "Client must supply expected stock")
assert.match(ui, /history && reservations/, "Disable edits if safety reports unavailable")
assert.match(ui, /onOpenOrder\(item\.publicId\)/, "Reservation issue should open existing order")
assert.match(ui, /window\.confirm\(/, "Require clear explicit confirmation")
assert.match(ui, /nextAvailableStock\(previous, mode, value\)/, "UI preview uses same quantity model")
assert.match(oldReservations, /orders\.payment_status = 'failed'/, "Existing fail-only timer release remains")
assert.match(oldReservations, /orders\.status = 'cancelled'/, "Existing cancel release behavior remains")
console.log("PASS: Admin V3 inventory arithmetic + additive migration + TSX static safety checks.")
console.log("NOTE: No database, full typecheck, build or browser checks are performed by this script.")
