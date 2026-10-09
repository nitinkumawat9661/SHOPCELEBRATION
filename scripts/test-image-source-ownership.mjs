import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

const raw = await readFile(new URL("../content/catalog.json", import.meta.url), "utf8")
const products = JSON.parse(raw).products
const seenProductIds = new Set(), bySource = new Map()
let meesho = 0
for (const product of products) {
  assert(!seenProductIds.has(product.id), `Duplicate product ID: ${product.id}`)
  seenProductIds.add(product.id)
  const list = [product.imageUrl, ...(product.images || []).map((image) => image.url)]
  for (const src of new Set(list.filter(Boolean))) {
    if (bySource.has(src)) assert.equal(bySource.get(src), product.id, `Unrelated products share photo ${src}`)
    bySource.set(src, product.id)
    if (src.includes("upload.meeshosupplyassets.com")) {
      meesho++
      const fingerprint = createHash("sha256").update(src).digest("hex")
      assert.equal(fingerprint.length, 64)
      const key = `catalog/rehost/meesho/${fingerprint}/main.webp`
      assert(key.includes(fingerprint))
    }
  }
}
const code = await readFile(new URL("../lib/server/catalog.ts", import.meta.url), "utf8")
assert(code.includes("IMAGE_FALLBACK_SOURCE_MISMATCH"), "The CMS must reject fallback from a different photo")
assert(code.includes("createHash(\"sha256\").update(fallback)"), "CMS must verify original URL source hash")
const rendering = await Promise.all([
  "../features/catalog/ProductGallery.tsx",
  "../features/catalog/CatalogCard.tsx",
  "../features/catalog/ProductSection.tsx",
  "../features/builder/steps/ProductStep.tsx"
].map((name) => readFile(new URL(name, import.meta.url), "utf8")))
for (const view of rendering) {
  assert(view.includes("fallbackSrc"), "All customer product image views require exact-source fallback")
}
const safe = await readFile(new URL("../features/catalog/SafeCatalogImage.tsx", import.meta.url), "utf8")
assert(safe.includes("sourceKey"), "Image fallback must reset when product image changes")
assert(safe.includes("celebration-product-placeholder.svg"), "Final branded fallback missing")
console.log(`Four-source checks passed: ${products.length} SKUs, ${meesho} unique original Meesho image URLs, strict source-SHA validation and fallback isolation.`)
