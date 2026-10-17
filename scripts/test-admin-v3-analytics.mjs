import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const source = path => readFileSync(path, "utf8")
const paths = [
  "lib/server/admin-behaviour-analytics.ts",
  "app/api/admin/analytics/v3/route.ts",
  "features/admin/v3/AdminAnalyticsV3.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "app/admin/v3/page.tsx"
]
for (const path of paths) {
  const parsed = ts.createSourceFile(
    path, source(path), ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  assert.deepEqual(
    parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [], "TS / TSX syntax error in " + path
  )
}

const service = source(paths[0])
const route = source(paths[1])
const ui = source(paths[2])
const shell = source(paths[3])
const page = source(paths[4])
const analyticsOld = source("lib/server/conversion-analytics.ts")
const wishlistSchema = source("db/migrations/046_customer_wishlist_sync.sql")
const conversionSchema = source("db/migrations/005_campaigns_conversion_analytics.sql")
const orderLine = source("lib/domain/order.ts")
const css = source("styles/admin-v3-analytics.css")

assert.match(page, /getAdminAccessState\(\)/, "Passkey protected V3")
assert.match(page, /admin-v3-analytics\.css/, "V3-only CSS import")
assert.match(shell, /<AdminAnalyticsV3 catalog=\{catalog\}/, "Analytics menu renders operational screen")
assert.match(route, /isAdminRequest\(\)/, "Report is admin-only")
assert.match(route, /consumeRequestRateLimit\(/, "Analytics reads are rate-limited")
assert.match(route, /private, no-store/, "Sensitive reporting is not cached")
assert.match(route, /parseBehaviourPeriod\(/, "Days period is validated")
assert.match(route, /export async function GET/, "Only read-only reporting endpoint")
assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/,
  "New endpoint must not mutate customer or checkout data")
assert.match(service, /getConversionAnalytics\(days\)/, "Reuse canonical conversion reporting")
assert.match(service, /count\(DISTINCT account_id\)/, "Account wishlist aggregated without IDs")
assert.match(service, /FROM customer_wishlist/, "Wishlist derived only from registered DB")
assert.match(service, /count\(DISTINCT o\.id\)/, "Product line order counts are distinct per order")
assert.match(service, /jsonb_array_elements\(o\.line_items\)/, "Use historical line items")
assert.match(service, /payment_status IN \('paid','verified'\)/, "Paid product ranking based on payment status")
assert.match(service, /status <> 'cancelled'/, "Cancellation excluded")
assert.match(service, /gross_line_paise/, "Line values not presented as refund-net revenue")
assert.match(service, /interval '60 minutes'/, "Inactivity threshold must be explicit")
assert.match(service, /latest_payment_start_at < checkout_at/, "Only later payment-start event counts as progress")
assert.match(service, /identifiableCheckoutRecoveryAvailable: false/, "No guest checkout recovery claim")
assert.match(service, /cartAbandonmentAvailable: false/, "No guest cart abandonment metric")
assert.doesNotMatch(service, /SELECT\s+.*customer_account_id|SELECT\s+.*session_hash\s+AS\s+/i,
  "Do not return customer or session IDs in API projection")
assert.doesNotMatch(service, /(?:phone|address|email)\s*:/i,
  "No personal contact information in analytics service")
assert.match(ui, /<b>not<\/b> a confirmed abandoned checkout/, "Explain telemetry is not proven abandonment")
assert.match(ui, /No central cart ledger exists/, "Do not invent guest carts")
assert.match(ui, /guest favourites are not included/i, "Guest wishlist cannot be observed")
assert.match(ui, /before cart-wide discounts/, "Historical gross line attribution note")
assert.match(ui, /Current-category attribution/, "Historical taxonomy limitations labelled")
assert.match(ui, /Asia\/Kolkata/, "Timezone disclosed")
assert.match(ui, /AbortController/, "Abort stale analytics requests")
assert.match(analyticsOld, /count\(DISTINCT session_hash\)/, "Existing event sessions are deduplicated")
assert.match(wishlistSchema, /PRIMARY KEY \(account_id, product_id\)/, "Wishlist entries account-owned")
assert.match(conversionSchema, /session_hash text NOT NULL/, "Tracked session remains hash-only")
assert.match(orderLine, /lineTotalPaise: number/, "Order item snapshots include gross line value")
assert.match(css, /@media\(max-width:500px\)/, "Responsive mobile layout")
console.log("PASS: Admin V3 Analytics TSX parser and static contract checks.")
console.log("NOT DONE: end-to-end DB queries, tsc project typecheck, browser or staging integration tests.")
