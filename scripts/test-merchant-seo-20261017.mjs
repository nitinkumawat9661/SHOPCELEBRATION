import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const robots = file("app/robots.ts")
const sitemap = file("app/sitemap.ts")
const product = file("app/jewelry/[id]/page.tsx")
const workflow = file(".github/workflows/deploy-production.yml")

// Public R2 image requests must be allowed while the rest of /api stays blocked.
assert.ok(robots.includes('allow: ["/", "/api/catalog/image?key="]'))
assert.ok(robots.includes('"/api"'))
assert.ok(robots.includes('"/account"'))
assert.ok(workflow.includes("Allow: /api/catalog/image?key="))

// Every sitemap fetch must not pretend all products have just been edited.
assert.ok(sitemap.includes("getCatalogConfig()"))
assert.ok(sitemap.includes("product.active !== false"))
assert.ok(sitemap.includes("encodeURIComponent(product.id)"))
assert.ok(!sitemap.includes("lastModified: now"))
assert.ok(!sitemap.includes("lastModified: new Date()"))

// Product entities use actual live price/stock; avoid invented aggregate ratings.
assert.ok(product.includes('"@type": "Product"'))
assert.ok(product.includes('"@id":'))
assert.ok(product.includes('url: productUrl'))
assert.ok(product.includes('priceCurrency: "INR"'))
assert.ok(product.includes("(product.salePricePaise! / 100).toFixed(2)"))
assert.ok(product.includes("isIndividualListing(product)"))
assert.ok(product.includes("isIndividuallySellable(product)"))
assert.ok(product.includes('https://schema.org/OutOfStock'))
assert.ok(!product.includes("aggregateRating:"))
console.log("PASS: merchant image crawl, product identity and sitemap accuracy")
