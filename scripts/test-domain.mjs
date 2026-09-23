import ts from 'typescript'
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { createRequire } from "node:module"

const root = process.cwd()
const out = join(root, ".domain-test")
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

async function compileTree(sourceDir) {
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name)
    if (entry.isDirectory()) {
      await compileTree(source)
      continue
    }
    const rel = relative(root, source)
    const target = join(out, rel.replace(/\.ts$/, ".js"))
    await mkdir(dirname(target), { recursive: true })
    if (entry.name.endsWith(".ts")) {
      const text = await readFile(source, "utf8")
      const result = ts.transpileModule(text, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
          resolveJsonModule: true
        },
        fileName: source
      })
      await writeFile(target, result.outputText)
    }
  }
}

await compileTree(join(root, "lib", "domain"))
await compileTree(join(root, "lib", "validation"))
await compileTree(join(root, "config"))
await cp(join(root, "content"), join(out, "content"), { recursive: true })
await cp(join(root, "config"), join(out, "config-json"), { recursive: true })
for (const entry of await readdir(join(root, "config"))) {
  if (entry.endsWith(".json")) await cp(join(root, "config", entry), join(out, "config", entry))
}

const require = createRequire(import.meta.url)
const catalog = require(join(out, "lib", "domain", "catalog.js"))
const order = require(join(out, "lib", "domain", "order.js"))
const orderConfig = require(join(out, "config", "order.js")).orderConfig
const fixtureCatalog = catalog.defaultCatalog

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const lowTier = catalog.tierById(fixtureCatalog, "t299")
const premium = catalog.productById(fixtureCatalog, "premium-perfume")
assert(lowTier && premium, "Fixture data missing")
assert(catalog.canSelectProduct(fixtureCatalog, lowTier, [], premium).ok === false, "Low tier allowed premium product")
assert(catalog.normalizeSelection(fixtureCatalog, lowTier, ["custom-card", "chocolates", "premium-perfume"]).length <= lowTier.maxChoices, "Selection normalization failed")

const future = new Date(Date.now() + 7 * 86400000)
const requiredDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(future)
const valid = {
  tierId: "t499",
  selectedProductIds: ["custom-card", "chocolates"],
  requiredDate,
  customerName: "Test Customer",
  phone: "9876543210",
  receiverName: "Test Receiver",
  address: "A valid delivery address",
  city: "Test City",
  state: "Test State",
  pincode: "332001",
  occasion: "Birthday",
  message: "",
  paymentReference: "ABC123456",
  policyVersion: orderConfig.policyVersion,
  policyAccepted: true,
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000"
}
const normalized = order.normalizeOrderInput(valid, "Asia/Kolkata", fixtureCatalog)
assert(normalized.amountPaise === 49900, "Server amount was not derived from tier")
assert(normalized.phone === "9876543210", "Phone normalization failed")

const expectCode = (changes, code) => {
  try { order.normalizeOrderInput({ ...valid, ...changes }, "Asia/Kolkata", fixtureCatalog) }
  catch (error) { if (error?.code === code) return }
  throw new Error(`Expected ${code}`)
}
expectCode({ requiredDate: "2026-02-31" }, "INVALID_REQUIRED_DATE")
expectCode({ tierId: "t299", selectedProductIds: ["premium-perfume"] }, "PRODUCT_NOT_ELIGIBLE_FOR_TIER")
expectCode({ policyAccepted: false }, "POLICY_VERSION_MISMATCH")
expectCode({ idempotencyKey: "not-a-uuid" }, "INVALID_IDEMPOTENCY_KEY")
expectCode({ paymentReference: "@@" }, "INVALID_PAYMENT_REFERENCE")

await rm(out, { recursive: true, force: true })
console.log("Domain tests passed.")
