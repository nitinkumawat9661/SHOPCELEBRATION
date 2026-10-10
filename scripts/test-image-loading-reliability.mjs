import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")
const [source, gallery, cards, style, globals, catalog, ownership, oldMedia] = await Promise.all([
  read("features/catalog/SafeCatalogImage.tsx"),
  read("features/catalog/ProductGallery.tsx"),
  read("features/catalog/CatalogCard.tsx"),
  read("styles/catalog-image-reliability.css"),
  read("app/globals.css"),
  read("lib/domain/catalog.ts"),
  read("scripts/test-image-source-ownership.mjs"),
  read("scripts/test-catalog-media.mjs")
])

// Compile the REAL candidate builder (not a reimplemented copy) and execute
// its browser-independent logic against common failure/retry scenarios.
const begin = source.indexOf("function imageCandidates(")
const end = source.indexOf("\nexport function SafeCatalogImage", begin)
assert(begin >= 0 && end > begin, "Candidate pipeline must remain testable")
const helper = source.slice(begin, end)
const code = ts.transpileModule(
  'const CATALOG_IMAGE_FALLBACK = "/images/celebration-product-placeholder.svg";\n' + helper + "\n",
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText
const candidates = vm.runInNewContext(code + "\nimageCandidates", {})
const extract = (s) => Array.from(s, (x) => ({ url: x.url, srcSet: x.srcSet || undefined }))

const hosted = "/api/catalog/image?key=catalog/rehost/meesho/" + "a".repeat(64) + "/main.webp"
const original = "https://upload.meeshosupplyassets.com/owned-photo.webp"
const responsive = `${hosted} 900w, /api/catalog/image?key=catalog/rehost/meesho/${"a".repeat(64)}/zoom.webp 1600w`
assert.deepEqual(extract(candidates(hosted, original, responsive, "(max-width:700px) 100vw,50vw")), [
  { url: hosted, srcSet: responsive },
  { url: hosted, srcSet: undefined },
  { url: original, srcSet: undefined },
  { url: "/images/celebration-product-placeholder.svg", srcSet: undefined }
], "On bad zoom/srcset, retry SAME hosted main, then same-SKU original, then local placeholder")
assert.deepEqual(extract(candidates("https://shopcelebration.in/catalog/a.png", undefined, undefined, undefined)), [
  { url: "https://shopcelebration.in/catalog/a.png", srcSet: undefined },
  { url: "/images/celebration-product-placeholder.svg", srcSet: undefined }
], "Single-image legacy assets must not get invented angles")
assert.deepEqual(extract(candidates("", "", undefined, undefined)), [
  { url: "/images/celebration-product-placeholder.svg", srcSet: undefined }
], "Empty src must show a local branded placeholder")
assert.deepEqual(extract(candidates(hosted, hosted, undefined, undefined)), [
  { url: hosted, srcSet: undefined },
  { url: "/images/celebration-product-placeholder.svg", srcSet: undefined }
], "Do not try the same URL twice as primary + original")

// Visual resilience and race protection; these must remain active when a
// 404, 403, decode failure, stalled connection or gallery re-selection occurs.
for (const [needle, message] of [
  ['data-image-state=', "Image state must be observable"],
  ['safeCatalogImagePlaceholder', "Branded HTML fallback cannot depend on the CDN"],
  ['isBranded ? "Photo temporarily unavailable"', "Unavailable state must have honest copy"],
  ['typeof node.decode === "function"', "Wait for actually paintable decode"],
  ['node.complete && node.naturalWidth > 0', "Account for cached pre-hydration images"],
  ['!node.naturalWidth || !node.naturalHeight', "Reject zero-pixel/broken images"],
  ['onError=', "Handle browser 403/404 decode failures"],
  ['onLoad=', "Handle successful loads"],
  ['window.setTimeout(', "Advance stalled requests without a permanent blank"],
  ['latestKey.current !== key || imageRef.current !== node', "Ignore stale events from another gallery/SDK image"],
  ['key={`${sourceKey}:${index}`}', "Mount a fresh image for each candidate"],
  ['srcSet={candidate.srcSet}', "Never carry broken srcSet into original-photo fallback"]
]) assert(source.includes(needle), message)

assert(style.includes('.safeCatalogImageFrame[data-image-state="ready"]>img{opacity:1}'), "Successful image must replace branded loading card")
assert(style.includes(".safeCatalogImagePlaceholder"), "Fallback must be paintable independent of images")
assert(style.includes("background:linear-gradient("), "Fallback must not become a white box when SVG fails")
assert(style.includes(".marketplaceGalleryStage>.safeCatalogImageFrame"), "Gallery stage wrapper must have dimensions")
assert(style.includes(".safeCatalogImageFrame.catalogProductImage"), "Builder thumbnails must keep their dimensions")
assert(globals.trimEnd().endsWith('@import "../styles/catalog-image-reliability.css";'), "Image fallback CSS must override old white backgrounds")
assert(gallery.includes('key={`${product.id}:${current.url}`}'), "Gallery main image must reset on product + angle switch")
assert(gallery.includes("selection.productId === product.id"), "Gallery state must be isolated per SKU")
assert(gallery.includes("images.length > 1"), "Single-image gallery must not invent extra slides")
assert(gallery.includes("objectPosition={currentSprite?.backgroundPosition}"), "Legacy product sprites retain the correct crop")
assert(gallery.includes("<SafeCatalogImage") && gallery.includes("src={sprite?.url || catalogImageVariant"), "Gallery thumbnail sprite failures must not bypass fallback")
assert(!gallery.includes('backgroundImage: `url('), "Do not render unobservable CSS background photos in gallery")
assert(cards.includes('src={sprite.url}') && cards.includes('objectPosition={sprite.backgroundPosition}'), "Card sprite failures must use the same safe image loader")
assert(!cards.includes('backgroundImage: `url('), "Card sprites must not bypass onError")
assert(ownership.includes("IMAGE_FALLBACK_SOURCE_MISMATCH") && ownership.includes("Four-source checks"), "Keep cross-SKU image ownership checks")
assert(oldMedia.includes("67 verified original URLs") && catalog.includes('catalogImageVariant'), "Keep rehosted variant and original source contracts")

console.log("Task 1 image-loading checks passed: real candidate builder exercised, same-SKU fallback order, broken srcSet retry, empty and duplicate sources, gallery isolation, sprite safety and branded failure states.")
