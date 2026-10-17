import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const file = (path) => readFile(new URL("../" + path, import.meta.url), "utf8")
const [sitemapSource, catalogSource, catalogJson, listing, cards, productPage, robots, hamperPage] = await Promise.all([
  "app/sitemap.ts", "lib/domain/catalog.ts", "content/catalog.json",
  "features/catalog/CatalogCollection.tsx", "features/catalog/CatalogCard.tsx",
  "app/jewelry/[id]/page.tsx", "app/robots.ts", "app/curated-hampers/page.tsx"
].map(file))

assert(sitemapSource.includes('export const dynamic = "force-dynamic"'),
  "Sitemap must reflect owner admin DB publications without a new GitHub deployment")
assert(sitemapSource.includes("getPublicCatalogConfig()"),
  "Live product catalog, not a stale bootstrap snapshot, must feed sitemap")
assert(sitemapSource.includes("product.active !== false"),
  "Draft/inactive product pages must not enter sitemap")
assert(sitemapSource.includes("primaryProductImage(product)?.url") &&
       sitemapSource.includes("catalogImageVariant(url, \"main\")"),
  "Use exact-SKU real product photographs, not promotional/fallback stock art")
assert(sitemapSource.includes("images: [image]"),
  "Next.js must emit legitimate image:image links for eligible SKU images")
assert(!sitemapSource.includes("lastModified:") && !sitemapSource.includes("lastmod:"),
  "Do not invent product modification dates")
assert(hamperPage.includes('alternates: { canonical: "/curated-hampers" }'),
  "Curated hampers public page must be canonical and eligible for sitemap")
assert(!hamperPage.includes('index: false'), "Curated hamper should not be noindexed")
assert(listing.includes("visible.map((product)") && listing.includes("<CatalogCard"),
  "Shop page must internally link each visible product; sitemap alone is not sufficient")
assert(cards.includes('href={`/jewelry/${encodeURIComponent(product.id)}`}'),
  "Individual product cards must have server-renderable direct HTML link URLs")
assert(productPage.includes("alternates: { canonical }") &&
       productPage.includes('const canonical = `/jewelry/${encodeURIComponent(product.id)}`'),
  "Each live SKU must self-canonicalize, not collapse into /jewelry")
assert(robots.includes('allow: ["/", "/api/catalog/image?key="]'),
  "Product photographs exposed in sitemap must remain crawlable")
assert(robots.includes('"/api"') && robots.includes('"/account"'),
  "Public crawl rules must not disclose private API/account links")

const fragment = catalogSource.match(/export function catalogImageVariant\([\s\S]*?\n}/)
assert(fragment, "Original owned 360/900/1600 image variants no longer available")
const compiledVariant = ts.transpileModule(fragment[0], {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const variants = { exports: {} }
runInNewContext(compiledVariant, {
  exports: variants.exports, URLSearchParams
})
const catalogImageVariant = variants.exports.catalogImageVariant
let products = JSON.parse(catalogJson).products
const bootstrap = products.filter((product) => product.active !== false)

const mockedModules = {
  "../lib/domain/catalog": {
    catalogImageVariant,
    primaryProductImage: (product) => product.images?.find((item) => item?.url) ||
      (product.imageUrl ? { url: product.imageUrl } : undefined)
  },
  "../lib/server/public-storefront": {
    getPublicCatalogConfig: async () => ({ catalog: { products } })
  }
}
const transpiledSitemap = ts.transpileModule(sitemapSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const sitemapModule = { exports: {} }
runInNewContext(transpiledSitemap, {
  exports: sitemapModule.exports,
  require: (name) => {
    assert(Object.hasOwn(mockedModules, name), "Unexpected sitemap runtime import " + name)
    return mockedModules[name]
  }
})
const sitemap = sitemapModule.exports.default
assert.equal(typeof sitemap, "function")

const base = "https://shopcelebration.in"
const result = await sitemap()
const urls = result.map((item) => item.url)
assert.equal(result.length, bootstrap.length + 7,
  "One canonical sitemap URL per active SKU + 7 approved public page URLs")
assert.equal(new Set(urls).size, urls.length, "Duplicate indexable canonical URL")
const staticExpected = ["/", "/jewelry", "/curated-hampers", "/about", "/faq", "/compare", "/claim"]
assert.deepEqual(urls.slice(0, 7), staticExpected.map((path) => base + path))
for (const forbidden of ["/admin", "/cart", "/account", "/policies", "/terms", "/privacy", "/track", "/payment"]) {
  assert(!urls.includes(base + forbidden), "Sensitive/noindex route included in sitemap: " + forbidden)
}

for (const product of bootstrap) {
  const page = result.find((entry) => entry.url === `${base}/jewelry/${encodeURIComponent(product.id)}`)
  assert(page, "Missing Google discovery URL for active " + product.id)
  const original = product.images?.find((item) => item?.url)?.url || product.imageUrl
  const variant = original ? catalogImageVariant(original, "main") : undefined
  const owned = variant?.startsWith("/") && !variant.startsWith("//")
    ? base + variant
    : variant?.startsWith(base + "/") ? variant : undefined
  assert.deepEqual(page.images || [], owned ? [owned] : [],
    "Sitemap art does not match the genuine same-SKU source for " + product.id)
  assert(!page.lastModified, "Invented product edit timestamp")
}
const r2 = result.filter((entry) => entry.images?.[0]?.includes("catalog%2Frehost%2Fmeesho"))
const local = result.filter((entry) => entry.images?.[0]?.includes("/catalog/necklaces-optimized/"))
assert.equal(r2.length, 67, "Unexpected lost owned R2 product images")
assert.equal(local.length, 22, "Unexpected lost local necklace WebPs")

// Newly published admin products must be discoverable on the NEXT request.
products = [...products, {
  id: "test-new-live-sku", name: "Temporary Audit Product",
  category: "Trending Necklaces", active: true, sellIndividually: true,
  images: [{ url: "/catalog/test-new-live-sku.webp" }]
}]
const withNew = await sitemap()
assert.equal(withNew.length, result.length + 1, "New admin product invisible without deploy")
assert(withNew.some((entry) => entry.url === base + "/jewelry/test-new-live-sku" &&
  entry.images?.[0] === base + "/catalog/test-new-live-sku.webp"))
products[products.length - 1].active = false
assert.equal((await sitemap()).length, result.length,
  "Inactive product must leave sitemap automatically")
console.log(`PASS: ${bootstrap.length} active product canonical URLs, ${r2.length} R2 + ${local.length} local same-SKU image links, 7 static routes; live add/deactivate without redeploy; noindex pages excluded.`)
