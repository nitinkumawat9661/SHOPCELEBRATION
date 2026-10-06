import assert from "node:assert/strict"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"

const root = process.cwd()
const out = join(root, ".individual-catalog-test")
assert.equal(dirname(out), root)
await mkdir(out, { recursive: true })
try {
  const sources = ["lib/domain/catalog.ts", "lib/server/catalog.ts", "lib/server/db.ts", "lib/validation/text.ts", "config/validation.ts", "config/database.ts", "config/env.ts", "config/security.ts", "config/payment.ts"]
  for (const source of sources) {
    const result = ts.transpileModule(await readFile(join(root, source), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    const target = join(out, source.replace(/\.ts$/, ".js"))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, result.outputText)
  }
  for (const source of ["content/catalog.json", ...(await readdir(join(root, "config"))).filter((file) => file.endsWith(".json")).map((file) => `config/${file}`)]) {
    const target = join(out, source)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await readFile(join(root, source)))
  }
  const require = createRequire(import.meta.url)
  const { defaultCatalog, salePriceFromRupees, isIndividuallySellable, productImages, primaryProductImage } = require(join(out, "lib/domain/catalog.js"))
  const { normalizeCatalogConfig, CatalogValidationError } = require(join(out, "lib/server/catalog.js"))
  const { validation } = require(join(out, "config/validation.js"))
  const normalized = normalizeCatalogConfig(defaultCatalog)
  assert.equal(normalized.products.length, defaultCatalog.products.length, "Default catalog normalization changed the product count")
  const withProduct = (patch) => ({ ...defaultCatalog, products: [{ ...defaultCatalog.products[0], ...patch }] })
  const enabled = normalizeCatalogConfig(withProduct({ sellIndividually: true, salePricePaise: 1929 })).products[0]
  assert.equal(enabled.salePricePaise, 1929)
  assert.equal(isIndividuallySellable(enabled), true)
  assert.equal(isIndividuallySellable({ ...enabled, active: false }), false)
  assert.equal(isIndividuallySellable({ ...enabled, sellIndividually: false }), false)
  assert.equal(normalizeCatalogConfig(withProduct({ sellIndividually: false, salePricePaise: 1929 })).products[0].salePricePaise, 1929, "Paused individual sale can retain a configured price")

  const legacyImage = normalizeCatalogConfig(withProduct({ imageUrl: "https://example.com/legacy.webp" })).products[0]
  assert.equal(legacyImage.imageUrl, "https://example.com/legacy.webp")
  assert.deepEqual(legacyImage.images, [{ url: "https://example.com/legacy.webp", alt: legacyImage.name }])
  assert.equal(primaryProductImage(legacyImage)?.url, legacyImage.imageUrl)

  const galleryOnly = normalizeCatalogConfig(withProduct({
    imageUrl: undefined,
    images: [
      { url: "https://example.com/front.webp", alt: "Front view" },
      { url: "https://example.com/detail.webp", alt: "Detail view" }
    ],
    description: "Long-form product detail copy.",
    highlights: ["Premium finish", "Gift-ready"],
    badge: "Bestseller"
  })).products[0]
  assert.equal(galleryOnly.imageUrl, "https://example.com/front.webp", "Primary gallery image must mirror into legacy imageUrl")
  assert.deepEqual(productImages(galleryOnly).map((image) => image.url), ["https://example.com/front.webp", "https://example.com/detail.webp"])
  assert.equal(galleryOnly.description, "Long-form product detail copy.")
  assert.deepEqual(galleryOnly.highlights, ["Premium finish", "Gift-ready"])
  assert.equal(galleryOnly.badge, "Bestseller")

  assert.throws(
    () => normalizeCatalogConfig(withProduct({ images: [{ url: "https://example.com/a.webp" }, { url: "https://example.com/a.webp" }] })),
    (error) => error instanceof CatalogValidationError && error.code === "DUPLICATE_PRODUCT_IMAGE"
  )
  assert.throws(
    () => normalizeCatalogConfig(withProduct({ images: Array.from({ length: validation.catalog.maxImages + 1 }, (_, index) => ({ url: `https://example.com/${index}.webp` })) })),
    (error) => error instanceof CatalogValidationError && error.code === "TOO_MANY_PRODUCT_IMAGES"
  )
  assert.throws(
    () => normalizeCatalogConfig(withProduct({ images: [{ url: "http://example.com/insecure.webp" }] })),
    (error) => error instanceof CatalogValidationError && error.code === "INVALID_IMAGE_URL"
  )
  assert.throws(
    () => normalizeCatalogConfig(withProduct({ highlights: Array.from({ length: validation.catalog.maxHighlights + 1 }, (_, index) => `Feature ${index}`) })),
    (error) => error instanceof CatalogValidationError && error.code === "INVALID_PRODUCT_HIGHLIGHTS"
  )
  for (const [patch, code] of [[{ sellIndividually: true }, "SALE_PRICE_REQUIRED"], [{ sellIndividually: "true" }, "INVALID_INDIVIDUAL_SALE_SETTING"], ...[0, 99, -100, 100.5, "100", Number.NaN, Math.min(validation.catalog.maxPrice * 100, 2147483647) + 1].map((salePricePaise) => [{ sellIndividually: true, salePricePaise }, "INVALID_SALE_PRICE"])]) {
    assert.throws(() => normalizeCatalogConfig(withProduct(patch)), (error) => error instanceof CatalogValidationError && error.code === code)
  }
  assert.equal(salePriceFromRupees("1"), 100)
  assert.equal(salePriceFromRupees("1.05"), 105)
  assert.equal(salePriceFromRupees("19.29"), 1929)
  for (const input of ["", "0.99", "19.299", "1e3", "-1", "NaN", String(validation.catalog.maxPrice + 1)]) assert.equal(salePriceFromRupees(input), undefined)
  console.log("Individual catalog checks passed: prices, availability, gallery compatibility, validation and exact rupees-to-paise conversion.")
} finally {
  await rm(out, { recursive: true, force: true })
}
