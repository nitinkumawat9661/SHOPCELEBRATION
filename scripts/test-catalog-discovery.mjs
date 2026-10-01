import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const source = await readFile(new URL("../lib/domain/catalog-discovery.ts", import.meta.url), "utf8")
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { discoverProducts, isJewelryProduct } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
const products = [
  { id: "bracelet", name: "Pearl Bracelet", category: "Accessories", note: "A keepsake", minTier: 500 },
  { id: "ring", name: "Gold ring", category: "Jewellery", note: "A gift", minTier: 900 },
  { id: "gift", name: "Spring keepsake", category: "Personal", note: "Printed memory", minTier: 300 },
  { id: "hidden", name: "Silver necklace", category: "Jewelry", note: "", minTier: 100, active: false }
]
assert.equal(isJewelryProduct(products[0]), true)
assert.equal(isJewelryProduct({ name: "Snowflake", category: "JEWELRY" }), true)
assert.equal(isJewelryProduct({ name: "Earrings", category: "Accessories" }), true)
assert.equal(isJewelryProduct({ name: "Spring keyring", category: "Personal" }), false)
assert.equal(isJewelryProduct({ name: "Ring-bound notebook", category: "Stationery" }), false)
assert.deepEqual(discoverProducts(products).map((p) => p.id), ["bracelet", "ring"])
assert.deepEqual(discoverProducts(products, { view: "all", q: "  PRINTED " }).map((p) => p.id), ["gift"])
assert.deepEqual(discoverProducts(products, { view: "all", category: "Accessories" }).map((p) => p.id), ["bracelet"])
assert.deepEqual(discoverProducts(products, { view: "all", sort: "budget-low" }).map((p) => p.id), ["gift", "bracelet", "ring"])
assert.deepEqual(discoverProducts(products, { sort: "budget-high" }).map((p) => p.id), ["ring", "bracelet"])
assert.deepEqual(discoverProducts(products, { view: "all", sort: "name" }).map((p) => p.id), ["ring", "bracelet", "gift"])
assert.equal(discoverProducts(products, { category: "Unknown" }).length, 0)
assert.equal(discoverProducts(products, { q: "missing" }).length, 0)
assert.deepEqual(products.map((p) => p.id), ["bracelet", "ring", "gift", "hidden"])
console.log("Catalog discovery passed: jewelry matching, active-only filtering, search, category and hamper-budget sorting.")
