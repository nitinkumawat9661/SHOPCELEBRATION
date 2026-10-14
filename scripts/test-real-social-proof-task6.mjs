import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [proofSrc, orderSource, storefront, unusedRail, reviews, reviewUI, detail, route, adminRoute, photoRoute, migration, badge, css, globals, plan] = await Promise.all([
  "lib/domain/real-social-proof.ts",
  "lib/server/orders/read.ts",
  "features/home/Storefront.tsx",
  "features/home/ProofAndReviews.tsx",
  "lib/server/product-reviews.ts",
  "features/catalog/ProductReviews.tsx",
  "app/jewelry/[id]/page.tsx",
  "app/api/reviews/[productId]/route.ts",
  "app/api/admin/reviews/route.ts",
  "app/api/reviews/photo/[id]/route.ts",
  "db/migrations/036_real_product_reviews.sql",
  "features/catalog/BudgetSection.tsx",
  "styles/real-social-proof-task6.css",
  "app/globals.css",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md"
].map(read))

const js = ts.transpileModule(proofSrc, { compilerOptions: {
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText
const moduleExports = {}
vm.runInNewContext(js, { exports:moduleExports })
const accepts = moduleExports.isPublicHamperOrderProof
assert.equal(typeof accepts, "function", "Execute actual public proof eligibility checker")
const tiers = [{ name:"Starter",active:true },{ name:"Large",active:true },{ name:"Legacy",active:false }]
const good = { tierName:"Starter",orderCount:12,totalOrders:40,sharePercent:30 }
assert.equal(accepts(good, tiers), true, "Real, sufficiently large matching cohort must be visible")
for (const [sample,reason] of [
  [null,"no proof"],[undefined,"undefined proof"],[{}, "empty data"],
  [{...good,tierName:"Legacy"},"inactive tier"],
  [{...good,tierName:"Made-up"},"unknown tier"],
  [{...good,tierName:""},"empty name"],
  [{...good,totalOrders:19,orderCount:10,sharePercent:53},"too small a cohort"],
  [{...good,orderCount:4,sharePercent:10},"less than 5 qualifying orders"],
  [{...good,orderCount:41,sharePercent:100},"count exceeding total"],
  [{...good,orderCount:-1,sharePercent:0},"negative count"],
  [{...good,totalOrders:40.4},"non-integer total"],
  [{...good,sharePercent:99},"inconsistent percentage"],
  [{...good,sharePercent:101},"impossible percentage"],
  [{...good,totalOrders:0,orderCount:0,sharePercent:0},"zero-order dataset"]
]) assert.equal(accepts(sample, tiers), false, `Reject ${reason}`)
assert.equal(accepts({tierName:"Starter",totalOrders:20,orderCount:5,sharePercent:25}, tiers), true, "Minimum genuine proof threshold allowed")
assert.equal(accepts({tierName:"Starter",totalOrders:20,orderCount:4,sharePercent:20}, tiers), false, "Public proof needs minimum 5 matching purchases")

// Counting paid + DELIVERED hamper orders is deliberately more strict than
// counting paid, processing or merely not-cancelled orders.
for (const contract of [
  "count(DISTINCT id)::int AS order_count",
  "status = 'delivered' AND order_type = 'hamper'",
  "payment_status IN ('paid', 'verified', 'success')",
  "tier_name IS NOT NULL",
  "row.total_orders < 20",
  "row.order_count < 5",
  "sharePercent < 20"
]) assert(orderSource.includes(contract), `Missing true order evidence or privacy gate: ${contract}`)
assert(!orderSource.includes("WHERE status <> 'cancelled' AND order_type = 'hamper'"), "Paid-but-unfulfilled orders must not count")
assert(storefront.includes("isPublicHamperOrderProof(initialSocialProof, tiers)") &&
  storefront.includes("initialSocialProof={visibleProof}"),
  "Only validated paid-and-delivered proof may reach homepage budget badges")
assert(badge.includes('socialProof && item.name === socialProof.tierName'), "Actual MOST CHOSEN badge is tied to the same verified active tier")
assert(!unusedRail.includes("★★★★★") && !unusedRail.includes("proofMarqueeTrack"),
  "No synthetic five-star review ticker even in dormant sections")
assert(unusedRail.includes("isPublicHamperOrderProof"), "Any optional order-proof panel must gate claims")

// No public review, photograph, or moderation can skip actual payment,
// delivered status, matching SKU and explicit admin review.
for (const requirement of [
  "JOIN orders o ON o.id = r.order_id AND o.customer_account_id = r.customer_account_id",
  "r.status = 'approved' AND r.reviewed_at IS NOT NULL",
  "a.phone_verified_at IS NOT NULL",
  "o.order_type = 'individual' AND o.status = 'delivered'",
  "o.payment_status IN ('paid','verified')",
  "item->>'productId' = r.product_id",
  "'pending'",
  "$2 = 'rejected' OR EXISTS",
  "r.status='approved' AND r.reviewed_at IS NOT NULL",
  "$2::boolean OR ("
]) assert(reviews.includes(requirement), `Missing reviewer trust check: ${requirement}`)
assert(!/INSERT\s+INTO\s+product_reviews/i.test(migration), "No fake review fixture seed")
assert(migration.includes("UNIQUE (customer_account_id, product_id)"), "One review per purchased SKU and account")
assert(route.includes("getCustomerSession()") && route.includes("enforceSameOrigin(request)") &&
  route.includes("consumeRequestRateLimit") && route.includes("normalizeReviewSubmission("),
  "Only authenticated, consented, rate-limited review requests can be submitted")
assert(adminRoute.includes("isAdminRequest()") && adminRoute.includes("enforceSameOrigin(request)") &&
  adminRoute.includes('body.status !== "approved" && body.status !== "rejected"'),
  "Only admin with genuine moderation intent may publish reviews")
assert(photoRoute.includes("approvedOrAdminPhotoKey"), "Public uploads must pass guarded approved photo lookup")
assert(reviewUI.includes("Be the first to review this product") &&
  reviewUI.includes("No verified customer reviews have been published yet."),
  "Show accurate empty state when no published review exists")
assert(reviewUI.includes("reviewsUnavailable") && reviewUI.includes("Customer reviews are temporarily unavailable"),
  "Do not assert there are zero reviews when database is unavailable")
assert(detail.includes('reviewsUnavailable={reviewsResult.unavailable}') && detail.includes('reviews={reviewsResult.items}'),
  "Product detail must pass database availability separately from truly empty results")
assert(css.includes(".celebrationHome .celebrationRealProof") && css.includes("@media(max-width:700px)"),
  "Minimal social-proof typography must adapt for mobile")
assert(!css.includes("@keyframes") && !css.includes("animation:"), "No fake live-count social proof motion")
assert(globals.includes('@import "../styles/real-social-proof-task6.css";'),
  "Task 6 CSS must be imported into storefront")
assert(plan.includes("Genuine verified reviews/media") && plan.includes("real catalogue"), "Follow user's approved actual-data and no-fake-proof rules")

console.log("Task 6 verified-proof checks passed: executed 14 real cohort guard cases, only paid+delivered 20+/5+ counts, active tiers, no fabricated review ticker, verified SKU/phone/order with admin moderation, honest no-data and database-outage states.")
