import assert from "node:assert/strict"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"

const root = process.cwd()
const output = join(root, ".product-reviews-test")
await mkdir(output, { recursive: true })
try {
  for (const src of ["lib/validation/text.ts", "lib/domain/reviews.ts"]) {
    const compiled = ts.transpileModule(await readFile(join(root, src), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    })
    const dst = join(output, src.replace(/\.ts$/, ".js"))
    await mkdir(dirname(dst), { recursive: true })
    await writeFile(dst, compiled.outputText)
  }
  const require = createRequire(import.meta.url)
  const { normalizeReviewSubmission, isReviewableOrder, ProductReviewError } = require(join(output, "lib/domain/reviews.js"))
  assert.deepEqual(normalizeReviewSubmission("5", "The necklace matches my order.", "yes"), {
    rating: 5, text: "The necklace matches my order."
  })
  for (const value of [0, 6, -1, "1.5", "not-a-number"]) {
    assert.throws(() => normalizeReviewSubmission(value, "Genuine customer experience.", "yes"),
      (e) => e instanceof ProductReviewError && e.code === "INVALID_RATING")
  }
  assert.throws(() => normalizeReviewSubmission(5, "Real customer experience.", "no"),
    (e) => e.code === "PUBLIC_REVIEW_CONSENT_REQUIRED")
  assert.throws(() => normalizeReviewSubmission(5, "Too short", "yes"),
    (e) => e.code === "INVALID_REVIEW_TEXT")
  assert.throws(() => normalizeReviewSubmission(5, "<script>Not acceptable</script>", "yes"),
    (e) => e.code === "UNSAFE_REVIEW")
  assert.equal(isReviewableOrder("delivered", "paid", "individual"), true)
  assert.equal(isReviewableOrder("delivered", "verified", "individual"), true)
  for (const sample of [
    ["preparing", "paid", "individual"], ["delivered", "pending", "individual"],
    ["cancelled", "paid", "individual"], ["delivered", "paid", "hamper"]
  ]) assert.equal(isReviewableOrder(...sample), false)

  const migration = await readFile(join(root, "db/migrations/036_real_product_reviews.sql"), "utf8")
  assert(!/INSERT\s+INTO\s+product_reviews/i.test(migration), "Never seed fake live reviews")
  assert(migration.includes("CHECK (rating BETWEEN 1 AND 5)"), "DB rating bounds required")
  assert(migration.includes("status IN ('pending', 'approved', 'rejected')"), "Moderation status enforced")
  assert(migration.includes("UNIQUE (customer_account_id, product_id)"), "One review per verified purchaser per product")

  const service = await readFile(join(root, "lib/server/product-reviews.ts"), "utf8")
  for (const term of ["customer_account_id", "status = 'delivered'", "payment_status IN ('paid','verified')", "item->>'productId'", "phone_verified_at IS NOT NULL", "'pending'", "r.status = 'approved'"]) {
    assert(service.includes(term) || service.includes(term.replaceAll(" = ", "=")), `Missing verified reviewer condition: ${term}`)
  }
  const routes = ["app/api/reviews/[productId]/route.ts", "app/api/admin/reviews/route.ts", "app/api/reviews/photo/[id]/route.ts"]
  const source = await Promise.all(routes.map((path) => readFile(join(root, path), "utf8")))
  assert(source[0].includes("getCustomerSession()") && source[0].includes("enforceSameOrigin(request)"), "Review submission requires signed-in same-site visitor")
  assert(source[0].includes("MAX_REQUEST_BYTES"), "Photo upload must be bounded")
  assert(source[1].includes("isAdminRequest()") && source[1].includes("enforceSameOrigin(request)"), "Review moderation requires authenticated admin")
  assert(source[2].includes("approvedOrAdminPhotoKey"), "Only approved customer photos can be viewed by the public")
  const product = await readFile(join(root, "features/catalog/ProductReviews.tsx"), "utf8")
  assert(product.includes("Be the first to review this product"), "Honest empty-state text required")
  assert(product.includes("reviewsUnavailable"), "A failed review query must not falsely claim zero published reviews")
  assert(service.includes("r.reviewed_at IS NOT NULL"), "Public reviews require actual admin moderation timestamp")
  assert(service.includes("JOIN orders o ON o.id = r.order_id") && service.includes("item->>'productId' = r.product_id"), "Public reviews must still match an actual delivered ordered SKU")
  assert(service.includes("$2 = 'rejected' OR EXISTS"), "Admin cannot approve a review without a qualifying delivery")
  assert(source[1].includes("enforceSameOrigin(request)") && source[1].includes("isAdminRequest()"), "Only privileged admins may moderate reviews")
  console.log("Real review tests passed: verified delivered orders, customer consent, moderation, private photos, no fake seeds.")
} finally {
  await rm(output, { recursive: true, force: true })
}
