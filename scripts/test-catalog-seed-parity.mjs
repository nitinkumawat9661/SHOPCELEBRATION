import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8")
const catalog = JSON.parse(await read("content/catalog.json"))
const ringImages = await read("db/migrations/032_update_ring_images_from_latest_workbook.sql")
const ringPrices = await read("db/migrations/030_reprice_adjustable_rings_111_151.sql")

// The bootstrap catalog must match the final, already-applied ring
// migrations. Live catalog edits still happen through Admin Draft/Publish.
const imageRows = Array.from(ringImages.matchAll(/\('(celebration-ring-\d{3})','(https:\/\/[^']+)','([^']+)'\)/g))
const priceRows = Array.from(ringPrices.matchAll(/\('(celebration-ring-\d{3})', (\d+), '([^']+)', '([^']+)'\)/g))
assert.equal(imageRows.length, 12, "Expected twelve canonical ring images")
assert.equal(priceRows.length, 12, "Expected twelve canonical ring prices")
const products = new Map(catalog.products.map((product) => [product.id, product]))
assert.equal(products.size, catalog.products.length, "Duplicate product ids in bootstrap catalog")
for (const [, id, imageUrl, name] of imageRows) {
  const product = products.get(id)
  assert(product, `Missing ring ${id}`)
  assert.equal(product.name, name, `Stale ring name: ${id}`)
  assert.equal(product.imageUrl, imageUrl, `Stale ring imageUrl: ${id}`)
  assert.deepEqual(product.images, [{ url: imageUrl, alt: name }], `Stale ring gallery: ${id}`)
}
for (const [, id, price, badge, unitPrice] of priceRows) {
  const product = products.get(id)
  assert(product, `Missing ring ${id}`)
  assert.equal(product.salePricePaise, Number(price), `Stale ring price: ${id}`)
  assert.equal(product.badge, badge, `Stale ring badge: ${id}`)
  assert.equal(product.retail?.unitSalePrice, unitPrice, `Stale ring unit declaration: ${id}`)
}
const correctedBangle = products.get("celebration-bangle-006")
assert.equal(correctedBangle?.salePricePaise, 16900)
assert.equal(correctedBangle?.retail?.unitSalePrice, "₹169 per piece, delivery included")
console.log("Bootstrap catalog parity passed: 12 ring names/images/prices and special bangle pricing.")
