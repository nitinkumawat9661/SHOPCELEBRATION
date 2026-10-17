import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const read = path => readFileSync(path, "utf8")
const paths = [
  "features/admin/v3/AdminCustomersV3.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "lib/server/admin-customers.ts",
  "app/api/admin/customers/route.ts",
  "app/api/admin/customers/[id]/route.ts",
  "app/admin/v3/page.tsx"
]
for (const path of paths) {
  const code = read(path)
  const parsed = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [], "Parser errors in " + path)
}
const service = read("lib/server/admin-customers.ts")
const directory = read("app/api/admin/customers/route.ts")
const detailRoute = read("app/api/admin/customers/[id]/route.ts")
const ui = read("features/admin/v3/AdminCustomersV3.tsx")
const shell = read("features/admin/v3/AdminDashboardV3.tsx")
const protectedPage = read("app/admin/v3/page.tsx")
const wishlistSchema = read("db/migrations/046_customer_wishlist_sync.sql")
const accountsSchema = read("db/migrations/004_customer_accounts_admin_v2.sql")
const css = read("styles/admin-v3-customers.css")

assert.match(protectedPage, /getAdminAccessState\(\)/, "Require original passkey gate")
assert.match(protectedPage, /admin-v3-customers\.css/, "Customer CSS should load only in V3")
assert.match(shell, /<AdminCustomersV3 catalog=\{catalog\}/, "Customer tab should mount real directory")
assert.match(shell, /setSelectedOrderId\(publicId\)/, "Linked order should open existing protected detail")
for (const route of [directory, detailRoute]) {
  assert.match(route, /isAdminRequest\(\)/, "Account data needs server-verified admin gate")
  assert.match(route, /consumeRequestRateLimit/, "Sensitive directory reads need rate limits")
  assert.match(route, /private, no-store/, "Sensitive account results should not be cached")
  assert.match(route, /export async function GET/, "Customers API remains read-only")
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/,
    "Customer V3 must not modify profile, orders or marketing permissions")
}
assert.match(service, /WHERE o\.customer_account_id = a\.id/, "Only verified account ID links orders")
assert.match(service, /WHERE customer_account_id = \$1/, "Detail order history must stay account-linked")
assert.match(service, /WHERE w\.account_id = a\.id/, "Wishlist statistics need account ownership")
assert.match(service, /FROM customer_wishlist/, "Saved products come from account-backed DB")
assert.match(service, /maskPhone\(row\.phone\)/, "Public admin response must mask phones")
assert.doesNotMatch(service, /phone:\s*row\.phone\s*[,}]/, "No raw account phone in response")
assert.doesNotMatch(service, /SELECT \*/, "Minimise selected columns; no password hashes")
assert.doesNotMatch(service, /password_hash|session_version|tracking_token_hash|provider_payment_id/,
  "Do not fetch passwords, tokens or private payment secrets")
assert.match(service, /includeAddress \? \{ savedAddress:/, "Address should be opt-in reveal only")
assert.match(service, /\? \", a\.default_address\" : \"\"/, "Do not select saved address by default")
assert.match(service, /status <> 'cancelled'/, "Cancelled orders must not count as paid-order value")
assert.match(service, /payment_status IN \('paid', 'verified'\)/, "Verify paid orders before counting value")
assert.match(ui, /Exact account records, not guest checkouts/, "UI must not imply guests are linked")
assert.match(ui, /Guest browser carts and saved/, "Guest localStorage data not exposed")
assert.match(ui, /Reveal saved address/, "Sensitive address must require explicit click")
assert.match(ui, /Paid-order value/, "Revenue semantics should be cautious")
assert.match(ui, /Before refunds/, "Paid order totals are not refund net")
assert.match(ui, /aria-label="Customer directory pages"/, "Pager remains accessible")
assert.match(ui, /AbortController/, "Abort stale customer reads on navigation")
assert.match(accountsSchema, /customer_account_id/, "Orders schema has direct account ID FK")
assert.match(wishlistSchema, /PRIMARY KEY \(account_id, product_id\)/, "Wishlist is account-owned")
assert.match(css, /@media\(max-width:500px\)/, "Responsive narrow layout provided")
console.log("PASS: Customers V3 source-contract tests and TSX parser checks")
console.log("NOT YET TESTED: PostgreSQL queries, complete tsc/Next build, real auth/browser or staging API.")
