import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const compiled = ts.transpileModule(read("lib/domain/owned-catalog-image-fallback.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const mod = { exports: {} }
runInNewContext(compiled, { module: mod, exports: mod.exports, URL })
const { locallyOwnedImageFallback, ownedR2ImageFallback } = mod.exports
const hash = "f".repeat(64)
const base = "/api/catalog/image?key=" + encodeURIComponent("catalog/rehost/meesho/" + hash + "/")
const photo = (size) => "/api/catalog/image?key=" + encodeURIComponent("catalog/rehost/meesho/" + hash + "/" + size + ".webp")
const external = "https://upload.meeshosupplyassets.com/cataloging/product.png"
assert.equal(ownedR2ImageFallback(photo("thumb")), photo("main"))
assert.equal(ownedR2ImageFallback(photo("main")), photo("zoom"))
assert.equal(ownedR2ImageFallback(photo("zoom")), photo("main"))
assert.equal(locallyOwnedImageFallback(photo("thumb"), external), photo("main"))
assert.equal(locallyOwnedImageFallback("https://shopcelebration.in/catalog/necklaces/celebration-necklace-001.png", external), undefined)
assert.equal(locallyOwnedImageFallback("https://attacker.example/photo.webp", external), undefined)
assert.equal(ownedR2ImageFallback(photo("main") + "&extra=1"), undefined)
assert.equal(ownedR2ImageFallback("/api/account/orders/customer-image?key=abc"), undefined)
assert.equal(locallyOwnedImageFallback("/catalog/my-photo.webp", "/catalog/fallback.webp"), "/catalog/fallback.webp")
const card = read("features/catalog/CatalogCard.tsx")
const gallery = read("features/catalog/ProductGallery.tsx")
const route = read("app/api/catalog/image/route.ts")
const r2 = read("lib/server/r2.ts")
assert.ok(card.includes("locallyOwnedImageFallback(catalogImageVariant(primary.url, imageVariant), primary.fallbackUrl)"))
assert.ok(gallery.includes("locallyOwnedImageFallback(currentSrc, current.fallbackUrl)"))
assert.ok(gallery.includes("locallyOwnedImageFallback(sprite?.url || catalogImageVariant"))
assert.ok(card.includes('loading={priority ? "eager" : "lazy"}'), "Offscreen cards remain native lazy")
assert.ok(gallery.includes('loading="eager"'), "Primary product hero remains eager")
assert.ok(route.includes("readCatalogImageObject(key)") && !route.includes("createCatalogImageViewUrl("))
assert.ok(route.includes("max-age=604800") && route.includes("max-age=3600"))
assert.ok(r2.includes("new GetObjectCommand") && r2.includes("isCatalogImageKey(key)"))
console.log("PASS: no Meesho browser fallbacks, no cross-SKU photos, native lazy loading, direct R2 reads and safe cache")
