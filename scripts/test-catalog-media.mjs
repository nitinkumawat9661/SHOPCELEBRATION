import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"

const root = new URL("../", import.meta.url)
const read = (file) => readFile(new URL(file, root), "utf8")
const seed = JSON.parse(await read("content/catalog.json"))
const sources = JSON.parse(await read("content/catalog-image-source-map.json")).products
const isMeesho = (url) => {
  try { return new URL(url).hostname === "upload.meeshosupplyassets.com" } catch { return false }
}
const external = new Set()
for (const product of seed.products) {
  if (isMeesho(product.imageUrl)) external.add(product.imageUrl)
  for (const image of product.images || []) if (isMeesho(image.url)) external.add(image.url)
}
const migration = await read("scripts/rehost-meesho-catalog-images.mjs")
const view = await read("features/catalog/SafeCatalogImage.tsx")
const gallery = await read("features/catalog/ProductGallery.tsx")
const card = await read("features/catalog/CatalogCard.tsx")
assert(migration.includes('redirect: "error"'), "Remote downloads must not follow redirects")
assert(migration.includes('MAX_BYTES'), "Bound incoming photo size")
for (const size of ["thumb", "main", "zoom"]) assert(migration.includes(size), `Missing ${size} WebP variant`)
assert(migration.includes('await database.query("ROLLBACK")'), "Catalog switch must rollback on error")
assert(migration.includes("CATALOG_CHANGED_DURING_DOWNLOAD"), "Protect concurrent catalog edits")
assert(view.includes("celebration-product-placeholder.svg"), "Missing branded fallback")
assert(card.includes("SafeCatalogImage") && gallery.includes("SafeCatalogImage"), "Product card and gallery require image fallback")
const scan = spawnSync(process.execPath, [new URL("scripts/rehost-meesho-catalog-images.mjs", root).pathname, "--dry-run"], {
  env: { ...process.env, DATABASE_URL: "" }, encoding: "utf8", timeout: 20000
})
assert.equal(scan.status, 0, scan.stderr)
assert.equal(external.size, 0, "Bootstrap primary image fields must be hosted by Celebration")
assert.equal(Object.keys(sources).length, 67, "All 67 verified original URLs must remain traceable to their SKUs")
assert(scan.stdout.includes("0 unique Meesho image sources"), "Bootstrap scan incorrectly reports third-party images")
console.log(`Catalog media checks passed: ${Object.keys(sources).length} original photo fallbacks preserved, zero primary Meesho image URLs.`)
