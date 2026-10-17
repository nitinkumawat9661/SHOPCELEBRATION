import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const read = file => readFileSync(file, "utf8")
const paths = [
  "lib/server/admin-review-queue.ts",
  "app/api/admin/reviews/v3/route.ts",
  "features/admin/v3/AdminReviewsV3.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "app/admin/v3/page.tsx"
]
for (const file of paths) {
  const parsed = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [], "TSX/TypeScript parsing failed: " + file)
}

const service = read(paths[0])
const route = read(paths[1])
const ui = read(paths[2])
const shell = read(paths[3])
const page = read(paths[4])
const oldRoute = read("app/api/admin/reviews/route.ts")
const existing = read("lib/server/product-reviews.ts")
const migration = read("db/migrations/036_real_product_reviews.sql")
const photo = read("app/api/reviews/photo/[id]/route.ts")
const css = read("styles/admin-v3-reviews.css")

assert.match(page, /getAdminAccessState\(\)/, "Current authenticated passkey gate retained")
assert.match(page, /admin-v3-reviews\.css/, "Review V3 stylesheet belongs to protected admin only")
assert.match(shell, /<AdminReviewsV3 catalog=\{catalog\}/, "Reviews tab should show live review screen")
assert.match(route, /isAdminRequest\(\)/, "Review listing only for admin")
assert.match(route, /consumeRequestRateLimit\(/, "Listing should be rate-limited")
assert.match(route, /private, no-store/, "Sensitive admin reports must not be cached")
assert.match(route, /export async function GET/, "V3 endpoint is read-only")
assert.doesNotMatch(route, /export async function (PATCH|POST|PUT|DELETE)/,
  "Do not add a second review moderation write endpoint")
assert.match(service, /LIMIT \$4 OFFSET \$5/, "Page results on the server")
assert.match(service, /pageSize = 25/, "Limit response size")
assert.match(service, /count\(\*\) FILTER \(WHERE status = 'pending'\)/, "Global status totals")
assert.match(service, /AVG|avg\(rating\)/, "Average must come from real approved rows")
assert.match(service, /r\.order_id/, "Link to original stored order for evidence")
assert.match(service, /o\.customer_account_id = r\.customer_account_id/, "Order must belong to submitting account")
assert.match(service, /a\.status = 'active' AND a\.phone_verified_at IS NOT NULL/, "Active verified account required")
assert.match(service, /o\.order_type = 'individual' AND o\.status = 'delivered'/, "Original delivered retail purchase required")
assert.match(service, /o\.payment_status IN \('paid','verified'\)/, "No unverified paid review approvals")
assert.match(service, /item->>'productId' = r\.product_id/, "Review SKU must occur in immutable ordered items")
assert.match(service, /approval_eligible_now/, "Only hint, server must recheck when writing")
assert.doesNotMatch(service, /SELECT \*/, "Query should not return customer/financial secrets")
assert.doesNotMatch(service, /(?:phone|address|email|tracking_token|password_hash)\s*:/i, "No sensitive response fields")
assert.match(ui, /fetch\("\/api\/admin\/reviews", \{/, "All moderation uses original protected endpoint")
assert.match(ui, /method: "PATCH"/, "Use original moderation API")
assert.match(ui, /action === "approved" && !review\.approvalEligibleNow/, "Never offer unverified approval")
assert.match(ui, /review\.status !== "pending"/, "Moderate pending submissions only")
assert.match(ui, /window\.confirm\(description\)/, "Moderation requires conscious confirmation")
assert.match(ui, /Do not suppress genuine negative ratings/, "No unjustified censorship")
assert.match(ui, /reject.*not.*low star rating/i, "Negative reviews cannot be rejected solely for sentiment")
assert.match(ui, /reason or separate immutable decision-audit log/, "Disclose lack of reason log")
assert.match(ui, /AbortController\(\)/, "Cancel stale requests")
assert.match(ui, /Review was already moderated/, "409 conflicts handled")
assert.match(ui, /orderPublicId/, "Linked real order evidence visible")
assert.match(oldRoute, /enforceSameOrigin\(request\)/, "Existing moderation mutation is same-origin")
assert.match(oldRoute, /isAdminRequest\(\)/, "Existing moderation requires admin")
assert.match(oldRoute, /moderateReview\(body\.id, body\.status\)/, "Original review workflow reused")
assert.match(existing, /r\.status='pending'/, "Server disallows re-moderation")
assert.match(existing, /\$2 = 'rejected' OR EXISTS/, "Server rechecks eligibility on approval")
assert.match(migration, /UNIQUE \(customer_account_id, product_id\)/, "One customer review per product")
assert.match(migration, /status IN \('pending', 'approved', 'rejected'\)/, "No unsupported hold/flagged state")
assert.match(photo, /approvedOrAdminPhotoKey/, "Customer photo remains protected")
assert.match(css, /@media\(max-width:450px\)/, "Mobile responsive styles")
console.log("PASS: V3 Reviews TSX parser and source-security/eligibility contracts.")
console.log("NOT VALIDATED: Runtime SQL queries, full project tsc/Next build, authenticated browser or database integration.")
