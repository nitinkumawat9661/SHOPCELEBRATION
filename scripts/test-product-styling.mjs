import assert from "node:assert/strict"
import { readFile, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"

const root = process.cwd()
const read = (path) => readFile(join(root, path), "utf8")
const temp = join(root, ".product-styling-test")
await mkdir(temp, { recursive: true })

try {
  const source = await read("lib/domain/product-styling.ts")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const compiled = join(temp, "product-styling.js")
  await writeFile(compiled, output)
  const { stylingAdviceForProduct } = createRequire(import.meta.url)(compiled)

  const data = JSON.parse(await read("content/catalog.json"))
  assert(data.products.length >= 89, "The catalog should include the existing jewelry listings")
  for (const product of data.products) {
    const advice = stylingAdviceForProduct(product)
    assert(["How to Style", "Gift ideas"].includes(advice.heading), `Each SKU needs accurate styling/gifting guidance: ${product.id}`)
    assert(["set","necklace","earrings","ring","wristwear","gift"].includes(advice.categoryKind), `Every SKU requires an explicit safe advice kind: ${product.id}`)
    assert(![advice.intro, ...advice.ideas, ...advice.care].some(line => /stainless steel|gold plated|silver plated|waterproof|hypoallergenic|6 months|adjustable fit|jd stone/i.test(line)), `Unverified physical composition in style advice: ${product.id}`)
    assert(advice.intro.length > 25, `Missing intro: ${product.id}`)
    assert(advice.ideas.length >= 3, `Missing style examples: ${product.id}`)
    assert(advice.care.length >= 2, `Missing care guidance: ${product.id}`)
    assert(!advice.ideas.some((idea) => /guaranteed|100%|never tarnish/i.test(idea)), `Unverified claim in advice for ${product.id}`)
  }

  const fixture = (category, name = "Test product") => stylingAdviceForProduct({ category, name })
  const set = fixture("Necklace + Earrings Sets")
  assert(set.pairingNote?.includes("together") && set.pairingNote.includes("separately"), "Sets must explicitly cover wearing together or separately")
  assert(set.ideas.some((idea) => idea.includes("earrings")), "Necklace + earrings sets require earring advice")
  assert(!fixture("Premium Anti-Tarnish Necklaces").pairingNote, "Necklaces alone must not get set advice")
  assert(fixture("Premium Anti-Tarnish Necklaces").ideas.some((idea) => idea.includes("layer")), "Necklace layer suggestion missing")
  assert(fixture("Adjustable Rings").ideas.some((idea) => idea.includes("ring")), "Rings need ring-specific advice")
  assert(fixture("Gold-Plated Bangles & Bracelets").intro.includes("wrist"), "Bracelets need wrist advice")
  assert(fixture("Stud Earrings").ideas.some((idea) => idea.includes("earrings")), "Earrings need earring-specific advice")
  const gift = fixture("Custom Gifts", "Teddy gift box")
  assert(gift.ideas.some((idea) => idea.includes("hamper")), "Gift-only item needs gifting ideas")
  assert(!gift.care.some((tip) => tip.includes("perfume")), "Do not tell gift-only customers to care for jewelry")
  assert.equal(gift.heading, "Gift ideas", "Do not call a teddy or hamper a wearable jewelry item")
  assert.equal(fixture("Designer Hair Accessories", "Necklace-shaped gift bag").categoryKind, "gift", "Confirmed gift-only category overrides tempting title keywords")
  assert.equal(fixture("Unknown", "Gold Ring Gift Box").categoryKind, "gift", "Unknown nonempty category must not claim jewelry fit")
  assert.equal(fixture("", "Simple Pendant").categoryKind, "necklace", "Allow safe name fallback only when the category is absent")
  assert.equal(fixture("Necklace + Earrings Sets").categoryKind, "set")
  assert.equal(fixture("Trending Necklaces").categoryKind, "necklace")
  assert.equal(fixture("Gold-Plated Bangles & Bracelets").categoryKind, "wristwear")
  assert.equal(fixture("Adjustable Rings").categoryKind, "ring")
  assert.equal(fixture("Stud Earrings").categoryKind, "earrings")
  const categoryKinds = {
    "Necklace + Earrings Sets":"set",
    "Premium Anti-Tarnish Necklaces":"necklace",
    "Trending Necklaces":"necklace",
    "Gold-Plated Bangles & Bracelets":"wristwear",
    "Adjustable Rings":"ring"
  }
  for(const item of data.products){
    assert.equal(stylingAdviceForProduct(item).categoryKind,categoryKinds[item.category],
      `Audit every actual SKU category (fail on new category until reviewed): ${item.id} ${item.category}`)
  }

  assert.equal(fixture("", "Simple Pendant").heading, "How to Style", "Fall back to a product title when category is unavailable")

  const [page, component, styles, globals, plan, packageJson] = await Promise.all([
    read("app/jewelry/[id]/page.tsx"),
    read("features/catalog/ProductHowToStyle.tsx"),
    read("styles/product-styling.css"),
    read("app/globals.css"),
    read("docs/WEBSITE_FINAL_IMPROVEMENT_PLAN.md"),
    read("package.json")
  ])
  assert(page.includes('import { ProductHowToStyle }'), "Product page must import styling section")
  assert(page.includes("<ProductHowToStyle product={product} />"), "Product page must render product-specific styling")
  assert(page.indexOf("<ProductHowToStyle product={product} />") < page.indexOf("<ProductReviews "), "Style section should appear before reviews")
  assert(component.includes("stylingAdviceForProduct(product)"), "Use product-specific resolver instead of repeated generic copy")
  assert(component.includes('aria-labelledby="product-styling-title"'), "Styling section must be accessible")
  assert(component.includes("advice.pairingNote"), "Render set-specific styling note")
  assert(globals.includes('@import "../styles/product-styling.css";'), "Styling stylesheet must load")
  assert(styles.includes("@media(max-width:750px)") && styles.includes("grid-template-columns:1fr"), "Mobile styling layout must stack without horizontal scroll")
  assert(plan.includes("## 5. How to Style"), "Keep changes in locked Section 5")
  assert(packageJson.includes("scripts/test-product-styling.mjs"), "Include tests in standard CI audit")
  console.log(`Section 5 styling checks passed for ${data.products.length} catalog SKUs, necklace sets, rings, earrings, bracelets and gift-only fallbacks.`)
} finally {
  await rm(temp, { recursive: true, force: true })
}
