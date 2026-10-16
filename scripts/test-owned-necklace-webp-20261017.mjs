import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8")
const catalogSource = await read("lib/domain/catalog.ts")
const fallbackSource = await read("lib/domain/owned-catalog-image-fallback.ts")
const css = await read("styles/catalog-image-reliability.css")
const build = await read("scripts/prepare-owned-necklace-webp.mjs")
const pkg = JSON.parse(await read("package.json"))
const ignore = await read(".gitignore")

const begin = catalogSource.indexOf("export function catalogImageVariant(")
const end = catalogSource.indexOf("\nexport function catalogSpriteImage(", begin)
assert(begin >= 0 && end > begin, "Expected real catalog image variant mapper")
function evaluate(source) {
  const mod = { exports: {} }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  runInNewContext(compiled, { exports: mod.exports, URLSearchParams, URL })
  return mod.exports
}
const { catalogImageVariant } = evaluate(catalogSource.slice(begin, end))
const { locallyOwnedImageFallback } = evaluate(fallbackSource)

for (let i = 1; i <= 22; i++) {
  const id = `celebration-necklace-${String(i).padStart(3, "0")}`
  const original = `https://shopcelebration.in/catalog/necklaces/${id}.png`
  for (const variant of ["thumb", "main", "zoom"]) {
    const derived = `/catalog/necklaces-optimized/${id}-${variant}.webp`
    assert.equal(catalogImageVariant(original, variant), derived, `No responsive variant for ${id}`)
    assert.equal(locallyOwnedImageFallback(derived, "https://evil.example/wrong.png"),
      `/catalog/necklaces/${id}.png`, `Original photo fallback mismatch for ${id}`)
  }
}
assert.equal(catalogImageVariant("https://shopcelebration.in/catalog/necklaces/celebration-necklace-023.png", "thumb"),
  "https://shopcelebration.in/catalog/necklaces/celebration-necklace-023.png", "Do not invent other SKU sources")
assert.equal(catalogImageVariant("https://other.example/catalog/necklaces/celebration-necklace-001.png", "thumb"),
  "https://other.example/catalog/necklaces/celebration-necklace-001.png", "No third-party rewrite")
assert.equal(locallyOwnedImageFallback("/catalog/necklaces-optimized/celebration-necklace-001-thumb.webp?junk=1"), undefined,
  "Never accept parameter-augmented owned fallbacks")
assert.equal(locallyOwnedImageFallback("https://other.example/catalog/necklaces-optimized/celebration-necklace-001-thumb.webp"), undefined,
  "Never use a different host for local fallback")

assert.equal(pkg.scripts.prebuild, "node scripts/prepare-owned-necklace-webp.mjs")
assert.equal(pkg.scripts.predev, "node scripts/prepare-owned-necklace-webp.mjs")
assert(ignore.includes("/public/catalog/necklaces-optimized/"), "Generated media should never be committed")
for (const required of ["EXPECTED = 22", "sharp", "withoutEnlargement: true", "thumb:", "main:", "zoom:", "rotate()", "await rename(temp, target)"]) {
  assert(build.includes(required), `Original exact-SKU WebP generation guard absent: ${required}`)
}
assert(css.includes("z-index:1;") && css.includes("z-index:0;"), "Loaded photos must paint above the branded fallback immediately")
assert(css.includes("opacity:1;") && !/\.safeCatalogImageFrame>img\s*\{[^}]*opacity:0/s.test(css),
  "Images must paint natively without waiting for client hydration/decode")
assert(css.includes('[data-image-state="unavailable"]>img{visibility:hidden}'),
  "The failed final candidate must not paint a broken-image icon")

console.log("PASS: 22 permanent-owned PNGs map to same-SKU responsive WebPs, original fallback, optimized build and native image paint")
