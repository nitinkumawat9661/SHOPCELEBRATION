import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import ts from "typescript"

const read = (path) => readFileSync(path, "utf8")
const workspace = read("features/admin/v3/AdminDashboardV3.tsx")
const details = read("features/admin/v3/AdminDetailsV3.tsx")
const editor = read("features/admin/AdminCatalogManager.tsx")
const orderCard = read("features/admin/AdminOrderCard.tsx")
const ordersHook = read("features/admin/useAdminOrders.ts")
const statusRoute = read("app/api/admin/orders/[publicId]/status/route.ts")
const shippingRoute = read("app/api/admin/orders/[publicId]/shipping/route.ts")
const catalogRoute = read("app/api/admin/catalog/route.ts")
const publishRoute = read("app/api/admin/catalog/publish/route.ts")
const files = [
  "app/admin/v3/page.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "features/admin/v3/AdminDetailsV3.tsx",
  "features/admin/AdminCatalogManager.tsx"
]
for (const path of files) {
  const parsed = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [], path + " must be valid TSX")
}
assert.match(workspace, /useAdminOrders\(\)/, "Use existing order operations hook")
assert.match(workspace, /<AdminOrderCard\b/, "Use verified shipping/status/packing operations component")
assert.match(workspace, /onStatus=\{\(status\) => admin\.updateStatus/, "Use existing workflow operation")
assert.match(workspace, /onShipping=\{\(provider, trackingNumber, packed\) => admin\.saveShipping/, "Use existing Shipway operation")
assert.match(workspace, /onVideo=\{\(file\) => admin\.uploadVideo/, "Use existing video upload")
assert.match(details, /order\.lineItems/, "Purchased items come from immutable order lines")
assert.match(details, /order\.amountPaise/, "Order totals come from recorded order")
assert.match(orderCard, /adminAllowedTransitions\(order\.status\)/, "Enforce existing allowed transitions")
assert.match(orderCard, /does NOT automatically initiate a Cashfree refund/, "Refund safety warning must remain")
assert.match(statusRoute, /isAdminRequest\(\)/, "Status mutation remains admin protected")
assert.match(shippingRoute, /isAdminRequest\(\)/, "Shipping mutation remains admin protected")
assert.match(statusRoute, /updateOrderStatus\(/, "Status mutation uses existing server transitions")
assert.match(shippingRoute, /bookOrderWithShipway\(/, "Shipping uses existing server workflow")
assert.match(ordersHook, /__SHIPWAY_AUTO__/, "Keep existing Shipway booking path")
assert.match(editor, /focusProductId\?: string/, "Optional focused editor, old admin unchanged")
assert.match(editor, /onDirtyChange\?: \(dirty: boolean\) => void/, "Prevent navigation loss of unsaved edits")
assert.match(editor, /readOnly=\{focusMode\}/, "Do not permit changing live SKU identity")
assert.match(editor, /!focusMode && <><label>Available stock/, "Focused catalog editor must not mutate retail stock")
assert.match(editor, /ensureFocusedDraftFresh\(\)/, "Check draft conflict before focused write")
assert.match(editor, /REVIEW GLOBAL CATALOG PUBLISH/, "Entire-catalog diff impact must be acknowledged")
assert.match(editor, /onPublished\?\.\(\)/, "Refresh real data after catalog publish")
assert.match(catalogRoute, /isAdminRequest\(\)/, "Catalog writes remain admin protected")
assert.match(publishRoute, /isAdminRequest\(\)/, "Publish remains admin protected")
console.log("PASS: Admin V3 guarded functional integrations pass AST and source-contract checks")
console.log("NOTE: This is NOT a real database test, typecheck, build, browser run, or production verification.")
