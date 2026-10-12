import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")
const [catalogRaw, mapRaw, inventory, card, treatment, styling, globals, loadingCss, badgeLogic, gallery, doc] = await Promise.all([
  "content/catalog.json",
  "content/catalog-image-source-map.json",
  "docs/PRODUCT_IMAGE_ASSET_INVENTORY_TASK2.csv",
  "features/catalog/CatalogCard.tsx",
  "lib/domain/catalog-card-presentation.ts",
  "styles/product-card-natural-presentation.css",
  "app/globals.css",
  "styles/catalog-image-reliability.css",
  "lib/domain/catalog-badges.ts",
  "features/catalog/ProductGallery.tsx",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md"
].map(read))
const products = JSON.parse(catalogRaw).products
const map = JSON.parse(mapRaw).products
assert.equal(products.length, 89, "Check every current catalog SKU; a seed count change requires inventory update")
assert.equal(new Set(products.map(p => p.id)).size, products.length, "Duplicate SKU")
const csvRows = inventory.trim().split(/\r?\n/)
assert.equal(csvRows.length, products.length + 1, "Inventory must list all 89 products")
assert(csvRows[0].includes("photo_style_visual_audit"), "Visual proof status must be visible in audit")
const byImage = new Map()
let hosted = 0, localPng = 0, additionalAngles = 0
for (const product of products) {
  const images = product.images || []
  assert(images.length > 0, `Missing primary photo: ${product.id}`)
  assert.equal(product.imageUrl, images[0].url, `Card and gallery mismatch for ${product.id}`)
  if (images.length > 1) additionalAngles += images.length - 1
  const primary = product.imageUrl
  assert(!byImage.has(primary), `Duplicate image URL across SKUs ${product.id} and ${byImage.get(primary)}`)
  byImage.set(primary, product.id)
  assert(inventory.includes(`"${product.id}","${product.name.replace(/"/g, '""')}"`), `Missing catalog inventory entry: ${product.id}`)
  if (primary.startsWith("/api/catalog/image?key=")) {
    hosted++
    const key = new URLSearchParams(primary.split("?")[1]).get("key")
    assert.equal(key, map[product.id]?.mainKey, `R2 provenance mismatch for ${product.id}`)
    const hex = createHash("sha256").update(map[product.id].sourceUrl).digest("hex")
    assert.equal(key, `catalog/rehost/meesho/${hex}/main.webp`, `Wrong original-source SHA for ${product.id}`)
    assert(inventory.includes(`"${product.id}",`) && inventory.includes('"R2_REHOSTED_WEBP"'), "R2 inventory record absent")
  } else {
    localPng++
    assert(/^https:\/\/shopcelebration\.in\/catalog\/necklaces\/celebration-necklace-\d{3}\.png$/.test(primary),
      `Unknown/non-first-party asset requires manual review: ${product.id}`)
    assert(!map[product.id], `Unexpected Meesho original mapping for first-party PNG: ${product.id}`)
  }
}
assert.equal(hosted, 67, "Unexpected number of R2 rehosted SKUs")
assert.equal(localPng, 22, "Unexpected number of existing first-party PNGs")
assert.equal(additionalAngles, 0, "New verified angles require a fresh photograph source audit")
assert.equal(Object.keys(map).length, 67, "All original R2 records must remain available")
assert(doc.includes("## Phase 2 — Jewellery Listing + Product Detail"), "Track progress only in user's approved plan")

// Execute the actual TS presentation selector: variety is styling only, not
// claims that an unverified image is a close-up, on-model or product-only.
const code = ts.transpileModule(treatment.replace('import type { GiftProduct } from "./catalog"', ""), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const exportsRef = {}
vm.runInNewContext(code, { exports: exportsRef })
const presentations = products.map(p => exportsRef.catalogCardTreatment(p))
assert.deepEqual(new Set(presentations).size, 3, "All three restrained editorial treatments must occur")
for (const product of products) {
  assert.equal(exportsRef.catalogCardTreatment(product), exportsRef.catalogCardTreatment(product),
    "Card style must be deterministic")
}
assert(card.includes('catalogCardTreatment(product)'), "Cards must derive visual treatment only from stable SKU metadata")
for (const label of ["paper", "clean", "folio"]) {
  assert(styling.includes(`catalogCard--${label}`), `Missing CSS treatment: ${label}`)
}
assert(card.includes('<div className="catalogCardMedia"><CatalogProductImage product={product} imageVariant={imageVariant} /></div>'),
  "Product card uses its own exact SKU photo at the requested resolution")
assert(card.includes('imageVariant = "thumb"') && card.includes('catalogImageVariant(primary.url, imageVariant)'),
  "Listings retain exact-SKU thumb default; featured homepage may request exact-SKU main")

assert(card.includes("productBadge(product)") && card.includes("productSavingLabel(product)"),
  "Keep evidence-driven badges and valid price savings")
assert(card.includes('catalogCardBadgeInline'), "Position badge outside image; keep actual badge content")
assert(card.includes("{product.name}") && card.includes("product.salePricePaise") &&
  card.includes("product.stockAvailable"), "Preserve names, price and stock")
assert(styling.includes(".catalogCardMedia .safeCatalogImageFrame>img"), "Reliable SafeCatalogImage must control media")
assert(styling.includes("object-fit:contain") && styling.includes("transform:none"), "Do not crop brand composites or the jewelry details")
assert(!/filter:\s*(?:blur|grayscale|brightness|contrast|hue-rotate)/i.test(styling),
  "Do not fake photo variety by altering product colours or textures")
assert(!styling.includes("content:\"") && !styling.includes("background-image:url"),
  "Do not add fictional overlays, labels or product decoration")
assert(styling.includes(".catalogCardInfo .catalogCardBadgeInline"), "Badge must be outside product photograph")
assert(styling.includes("@media(max-width:700px)") && styling.includes("@media(max-width:360px)"),
  "Mobile cards must be sized deliberately")
assert(styling.includes("@media(prefers-reduced-motion:reduce)"),
  "Respect reduced-motion preferences")
assert(globals.indexOf("product-card-natural-presentation.css") > globals.indexOf("catalog-image-reliability.css"),
  "Editorial layer must not precede the image reliability layer")
assert(loadingCss.includes("safeCatalogImagePlaceholder"), "Branded fallback must survive card redesign")
assert(gallery.includes("productImages(product)") && gallery.includes("images.length > 1"),
  "No fake extra photo angles or carousel duplicates")
assert(badgeLogic.includes("productDiscountPercent(product)") && !/Math\.random/.test(treatment),
  "Badges stay truthful and visual framing stays deterministic")
console.log(`Task 2 catalog audit passed: ${products.length} SKU IDs intact, ${hosted} original-hash-verified R2 assets, ${localPng} first-party PNGs, ${additionalAngles} genuine extra views; badges outside imagery, full-image presentation, 3 layouts, mobile and loading safeguards.`)
