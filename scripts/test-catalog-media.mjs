import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"

const root = new URL("../", import.meta.url)
const read = (file) => readFile(new URL(file, root), "utf8")
const seed = JSON.parse(await read("content/catalog.json"))
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
assert(scan.stdout.includes(`${external.size} unique Meesho image sources`), "Bootstrap URLs scanned incorrectly")
console.log(`Catalog media checks passed; bootstrap has ${external.size} Meesho-hosted images pending actual migration.`)
