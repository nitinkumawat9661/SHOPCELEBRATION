import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const robots = file("app/robots.ts")
const sitemap = file("app/sitemap.ts")
const product = file("app/jewelry/[id]/page.tsx")
// The deployment intentionally excludes .github from immutable VPS releases.
// Only check deployment-source assertions when running inside GitHub checkout.
const workflowPath = new URL("../.github/workflows/deploy-production.yml", import.meta.url)

// Public R2 image requests must be allowed while the rest of /api stays blocked.
assert.ok(robots.includes('allow: ["/", "/api/catalog/image?key="]'))
assert.ok(robots.includes('"/api"'))
assert.ok(robots.includes('"/account"'))
if (existsSync(workflowPath)) {
  assert.ok(readFileSync(workflowPath, "utf8").includes("Allow: /api/catalog/image?key="))
}

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

// Execute the pure schema factory to validate actual nested JSON-LD payloads.
const merchantSource = file("lib/domain/merchant-seo.ts")
const compiled = ts.transpileModule(merchantSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const resultModule = { exports: {} }
runInNewContext(compiled, { module: resultModule, exports: resultModule.exports })
const { celebrationOrganizationMarkup, celebrationOfferShippingDetails, celebrationReturnPolicyReference } = resultModule.exports
const merchant = JSON.parse(JSON.stringify(celebrationOrganizationMarkup()))
const shipping = JSON.parse(JSON.stringify(celebrationOfferShippingDetails()))
const returnRef = JSON.parse(JSON.stringify(celebrationReturnPolicyReference()))
const layout = file("app/layout.tsx")

assert.equal(merchant["@type"], "OnlineStore")
assert.equal(merchant.name, "Celebration")
assert.equal(merchant.hasMerchantReturnPolicy.merchantReturnLink, "https://shopcelebration.in/policies")
assert.equal(merchant.hasMerchantReturnPolicy["@id"], returnRef["@id"])
assert.ok(!("returnPolicyCategory" in merchant.hasMerchantReturnPolicy))
assert.ok(!("merchantReturnDays" in merchant.hasMerchantReturnPolicy))
assert.equal(shipping["@type"], "OfferShippingDetails")
assert.equal(shipping.shippingRate.value, 0)
assert.equal(shipping.shippingRate.currency, "INR")
assert.equal(shipping.shippingDestination.addressCountry, "IN")
assert.equal(shipping.deliveryTime.handlingTime.minValue, 0)
assert.equal(shipping.deliveryTime.handlingTime.maxValue, 2)
assert.equal(shipping.deliveryTime.handlingTime.unitCode, "DAY")
assert.ok(!("transitTime" in shipping.deliveryTime), "Do not mislabel total 3–7 days as courier transit")
assert.match(layout, /<SeoJsonLd data={celebrationOrganizationMarkup\(\)} \/>/)
assert.match(product, /brand: \{ "@type": "Brand", name: "Celebration" \}/)
assert.match(product, /shippingDetails: celebrationOfferShippingDetails\(\)/)
assert.match(product, /hasMerchantReturnPolicy: celebrationReturnPolicyReference\(\)/)
assert.ok(!merchantSource.includes("gtin:") && !merchantSource.includes("gstin:"))
console.log("PASS: truthful Celebration branded offers, free jewellery shipping and linked merchant return policy")
