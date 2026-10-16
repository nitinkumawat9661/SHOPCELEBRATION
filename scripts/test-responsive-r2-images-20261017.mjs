import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
const read = (path) => readFileSync(new URL("../"+path, import.meta.url), "utf8")
function load(path, extra = {}) {
 const js = ts.transpileModule(read(path), {
   compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
 }).outputText
 const mod = { exports: {} }
 runInNewContext(js, {module: mod, exports: mod.exports, require, Buffer, URL, URLSearchParams, ...extra})
 return mod.exports
}
const perf = load("lib/domain/catalog-image-performance.ts")
const key = "catalog/rehost/meesho/" + "f".repeat(64) + "/thumb.webp"
const url = "/api/catalog/image?key=" + encodeURIComponent(key)
const thumb = perf.responsivePublicCatalogImage(url, "thumb")
const featured = perf.responsivePublicCatalogImage(url, "main")
const editorial = perf.responsivePublicCatalogImage("/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v7%2Fnecklaces.webp", "category")
assert.ok(thumb && featured && editorial)
assert.ok(thumb.src.includes("w=384"))
assert.ok(featured.src.includes("w=640"))
assert.ok(editorial.srcSet.includes("192w") && editorial.srcSet.includes("384w"))
assert.ok(thumb.srcSet.includes("256w") && thumb.srcSet.includes("828w"))
assert.equal(perf.responsivePublicCatalogImage("/api/account/customer-photo?key=abc", "thumb"), null)
assert.equal(perf.responsivePublicCatalogImage("https://stranger.example/api/catalog/image?key=abc", "thumb"), null)
assert.equal(perf.responsivePublicCatalogImage(url+"&other=1", "thumb"), null)
assert.equal(perf.responsivePublicCatalogImage("/api/catalog/image?key=catalog/../account/test.webp", "thumb"), null)
const resize = load("lib/server/public-catalog-image-resize.ts")
assert.equal(resize.requestedPublicCatalogImageWidth(new URLSearchParams("w=256")),256)
assert.equal(resize.requestedPublicCatalogImageWidth(new URLSearchParams("w=828")),828)
for (const bad of ["0","1","191","480","8000","10000","NaN","256.0"]) {
 assert.equal(resize.requestedPublicCatalogImageWidth(new URLSearchParams("w="+bad)), null)
}
const sharp = require("sharp")
const source = await sharp({
  create: {width: 800, height: 800, channels: 3, background: "#ceced0"}
}).png().toBuffer()
const result = await resize.resizePublicCatalogImage(source,256)
assert.ok(result && result.byteLength < source.byteLength)
const meta = await sharp(result).metadata()
assert.equal(meta.format,"webp")
assert.equal(meta.width,256)
assert.equal(meta.height,256)
assert.equal(await resize.resizePublicCatalogImage(source,9000),null)
const route = read("app/api/catalog/image/route.ts")
assert.ok(route.includes("requestedPublicCatalogImageWidth(params)"))
assert.ok(route.includes("publicCatalogImageCacheControl(key)"))
assert.ok(route.includes("new Uint8Array(bytes)"))
assert.ok(read("features/catalog/CatalogCard.tsx").includes('responsivePublicCatalogImage(requestedImage, imageVariant)'))
assert.ok(read("features/home/CategoryEditorialPhoto.tsx").includes('responsivePublicCatalogImage(src, "category")'))
assert.ok(read("features/home/CategoryEditorialPhoto.tsx").includes("showOriginal ? src : responsive?.src || src"))
console.log("PASS: exact-SKU R2 responsive image URLs, real WebP resizing, immutable original fallback and strict bounds")
