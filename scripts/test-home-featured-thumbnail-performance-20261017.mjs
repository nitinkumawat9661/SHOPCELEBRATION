import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8")
const [home, card, catalog, fallback, mediaAudit, seed, css] = await Promise.all([
  "features/home/HomeCatalog.tsx",
  "features/catalog/CatalogCard.tsx",
  "lib/domain/catalog.ts",
  "lib/domain/owned-catalog-image-fallback.ts",
  "scripts/rehost-meesho-catalog-images.mjs",
  "content/catalog.json",
  "styles/home-phase1-original-featured-grid-20261012.css"
].map(read))

assert(home.includes('<CatalogCard key={product.id} product={product} imageVariant="thumb" preserveFeaturedPortrait />'),
  "Home featured cards must request the smaller exact-SKU thumbnail, never 900x900 main")
assert(home.includes("photographed.map((product)"), "Preserve owner's exact four real featured selections")
assert(home.includes("featuredOrder") && home.includes("isIndividuallySellable"),
  "Do not replace genuine live featured product selection with fake imagery")
assert(card.includes('catalogImageVariant(primary.url, imageVariant)'),
  "Card image must remain the real primary photo of its own product")
assert(card.includes('locallyOwnedImageFallback(catalogImageVariant(primary.url, imageVariant), primary.fallbackUrl)'),
  "Keep same-SKU permanent fallback without external Meesho browser dependency")
assert(card.includes('preserveFeaturedPortrait = false') &&
       card.includes('(imageVariant === "main" || preserveFeaturedPortrait) && product.id === "celebration-ring-001"'),
  "Featured ring must retain its original portrait crop, not revert to default card layout")
assert(css.includes(".catalogCard--featuredPortraitRing"),
  "Keep original owner-approved two-column grid and portrait crop")
assert(mediaAudit.includes("thumb: 360, main: 900, zoom: 1600"),
  "Catalog must have existing generated 360px WebPs, with main/zoom still available on PDP")

const code = catalog.match(/export function catalogImageVariant\([\s\S]*?\n}\n/)
assert(code, "Missing exact-SKU image resolution mapping")
const exportsRef = {}
runInNewContext(ts.transpileModule(code[0], { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
}}).outputText, { exports: exportsRef, URLSearchParams })
const variants = exportsRef.catalogImageVariant
const products = JSON.parse(seed).products
const unique = new Set()
let checkedR2 = 0
let checkedLocal = 0
for (const product of products) {
  assert(!unique.has(product.id), "Duplicate SKU")
  unique.add(product.id)
  const src = product.imageUrl
  assert(src === product.images?.[0]?.url, "Primary image mismatch for " + product.id)
  const thumb = variants(src, "thumb")
  const main = variants(src, "main")
  if (src.includes("/api/catalog/image?key=")) {
    assert(thumb.includes("%2Fthumb.webp"), "R2 thumb mapping failed " + product.id)
    assert(main.includes("%2Fmain.webp"), "Product page main disappeared " + product.id)
    checkedR2++
  } else {
    assert(thumb.endsWith("-thumb.webp"), "Local thumb mapping failed " + product.id)
    checkedLocal++
  }
  assert.notEqual(thumb, main, "Unexpected 900px asset on thumbnail card " + product.id)
}
assert.equal(checkedR2, 67)
assert.equal(checkedLocal, 22)
assert(!/upload\.meeshosupplyassets\.com/.test(home), "Never load remote source photos on the homepage")
assert(fallback.includes("ownedR2ImageFallback"), "Fallback must remain source-verified")
console.log("PASS: all 89 exact-SKU images resolve to 360px thumbnails, 900px PDP unchanged, featured ring layout preserved.")
