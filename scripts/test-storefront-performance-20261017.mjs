import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const source = read("lib/domain/catalog-image-performance.ts")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const module = { exports: {} }
runInNewContext(compiled, { module, exports: module.exports, URL })
const optimize = module.exports.responsiveFirstPartyCardImage
const path = "https://shopcelebration.in/catalog/necklaces/celebration-necklace-001.png"
const preview = optimize(path, "thumb")
const feature = optimize(path, "main")
assert.ok(preview && feature)
assert.ok(preview.src.includes("%2Fcatalog%2Fnecklaces%2Fcelebration-necklace-001.png"))
assert.ok(preview.src.includes("&w=640&q=75"))
assert.ok(feature.src.includes("&w=828&q=75"))
assert.ok(preview.srcSet.includes("384w") && preview.srcSet.includes("828w"))
assert.equal(optimize("https://other.example/catalog/necklaces/celebration-necklace-001.png", "main"), null)
assert.equal(optimize("/api/catalog/image?key=test", "thumb"), null)
assert.equal(optimize("/catalog/necklaces/celebration-necklace-001.png?arbitrary=1", "thumb"), null)
assert.equal(optimize("/catalog/necklaces/celebration-necklace-001.svg", "thumb"), null)

const cards = read("features/catalog/CatalogCard.tsx")
const home = read("features/home/Storefront.tsx")
const builder = read("features/builder/useHamperBuilder.ts")
const tail = read("features/home/StorefrontTail.tsx")
const hero = read("features/home/Hero.tsx")
assert.ok(cards.includes("responsiveFirstPartyCardImage(requestedImage, imageVariant)"))
assert.ok(cards.includes("fallbackSrc={responsive ? requestedImage : primary.fallbackUrl}"))
assert.ok(cards.includes('loading={priority ? "eager" : "lazy"}'))
assert.ok(home.includes("<HomeCatalog catalog={initialCatalog}"))
assert.ok(home.includes("products: []"))
assert.ok(home.includes("<StorefrontDiscovery initialCatalog={curatedDiscoveryCatalog}"))
assert.ok(builder.includes("useHamperBuilder(initial"))
assert.ok(!builder.includes("catalog.products"), "Don't omit product details if builder becomes SKU-dependent")
assert.ok(!tail.includes("catalog.products"), "Homepage tail should stay tier/occasion-only")
assert.ok(hero.includes('unoptimized loading="eager" fetchPriority="high"'))
console.log("PASS: homepage client catalog projection, exact-SKU responsive images and eager hero LCP")
