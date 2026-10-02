import ts from 'typescript'
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { createRequire } from "node:module"
import { createHmac } from "node:crypto"

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
const providerSource = join(root, "lib", "server", "payments", "provider.ts")
const providerOutput = join(out, "lib", "server", "payments", "provider.js")
await mkdir(dirname(providerOutput), { recursive: true })
await writeFile(providerOutput, ts.transpileModule(await readFile(providerSource, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: providerSource }).outputText)
await cp(join(root, "content"), join(out, "content"), { recursive: true })
await cp(join(root, "config"), join(out, "config-json"), { recursive: true })
for (const entry of await readdir(join(root, "config"))) {
  if (entry.endsWith(".json")) await cp(join(root, "config", entry), join(out, "config", entry))
}

const require = createRequire(import.meta.url)
const catalog = require(join(out, "lib", "domain", "catalog.js"))
const order = require(join(out, "lib", "domain", "order.js"))
const payment = require(join(out, "lib", "domain", "payment.js"))
const orderConfig = require(join(out, "config", "order.js")).orderConfig
const fixtureCatalog = catalog.defaultCatalog
const ui = require(join(out, "lib", "domain", "content.js")).uiContent

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(ui.builder.stepLabels.length === 3, "Builder copy must match the three-step checkout")
assert(ui.builder.details.title.startsWith("2.") && ui.builder.payment.title.startsWith("3."), "Checkout section numbering does not match its steps")

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
assert(normalized.orderType === "hamper" && normalized.lineItems.length === 0, "Existing hamper order shape changed")
assert(payment.isPaymentConfirmed("paid", "preparing") && payment.isPaymentConfirmed("verified", "shipped"), "Confirmed payment was lost when fulfillment advanced")
assert(!payment.isPaymentConfirmed("pending", "payment_verification_pending"), "Unpaid order was considered paid")
try { payment.assertPaymentCanStart("cancelled"); throw new Error("Cancelled order could start payment") }
catch (error) { assert(error.message === "PAYMENT_ORDER_CANCELLED", "Wrong cancelled-order rejection") }
payment.assertPaymentCanStart("payment_verification_pending")

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
expectCode({ orderType: "something-else" }, "INVALID_ORDER_TYPE")

// Test-only sale prices; real catalog prices must be set by the store admin.
const individualCatalog = {
  ...fixtureCatalog,
  products: [
    { ...fixtureCatalog.products[0], id: "test-bracelet", name: "Test Bracelet", minTier: 1000, sellIndividually: true, salePricePaise: 34950 },
    { ...fixtureCatalog.products[0], id: "test-ring", name: "Test Ring", sellIndividually: true, salePricePaise: 25000 },
    { ...fixtureCatalog.products[0], id: "hamper-only", sellIndividually: false, salePricePaise: 10000 },
    { ...fixtureCatalog.products[0], id: "inactive", active: false, sellIndividually: true, salePricePaise: 10000 },
    { ...fixtureCatalog.products[0], id: "no-price", sellIndividually: true }
  ]
}
const individual = { ...valid, orderType: "individual", expectedSubtotalPaise: 94900, tierId: undefined, selectedProductIds: undefined, occasion: undefined, items: [{ productId: "test-bracelet", quantity: 2 }, { productId: "test-ring", quantity: 1 }] }
const individualNormalized = order.normalizeOrderInput({ ...individual, amountPaise: 1, paymentReference: undefined }, "Asia/Kolkata", individualCatalog, { requirePaymentReference: false })
assert(individualNormalized.amountPaise === 94900, "Individual total trusted browser price or quantity was wrong")
assert(individualNormalized.tierId === null && individualNormalized.orderType === "individual", "Individual purchase still depends on a hamper")
assert(individualNormalized.lineItems[0].unitPricePaise === 34950 && individualNormalized.lineItems[0].lineTotalPaise === 69900, "Individual line price snapshot is wrong")
assert(individualNormalized.occasion === "Individual purchase" && individualNormalized.selectedProductNames[0] === "Test Bracelet × 2", "Individual legacy order display is wrong")
const expectIndividualCode = (changes, code, productChanges = {}) => {
  const testCatalog = { ...individualCatalog, products: individualCatalog.products.map((product) => product.id === "test-bracelet" ? { ...product, ...productChanges } : product) }
  try { order.normalizeOrderInput({ ...individual, ...changes }, "Asia/Kolkata", testCatalog) }
  catch (error) { if (error?.code === code) return }
  throw new Error(`Expected individual ${code}`)
}
expectIndividualCode({ items: [] }, "EMPTY_CART")
expectIndividualCode({ expectedSubtotalPaise: undefined }, "INVALID_CART_TOTAL")
expectIndividualCode({ expectedSubtotalPaise: "94900" }, "INVALID_CART_TOTAL")
expectIndividualCode({ expectedSubtotalPaise: 1 }, "INVALID_CART_TOTAL")
expectIndividualCode({ expectedSubtotalPaise: 94800 }, "CART_PRICE_CHANGED")
expectIndividualCode({ items: Array.from({ length: 21 }, (_, i) => ({ productId: `test-${i}`, quantity: 1 })) }, "TOO_MANY_CART_ITEMS")
expectIndividualCode({ items: [{ productId: "test-bracelet", quantity: 1 }, { productId: "test-bracelet", quantity: 1 }] }, "DUPLICATE_CART_PRODUCT")
for (const quantity of [0, 11, 1.5, "2", null]) {
  expectIndividualCode({ items: [{ productId: "test-bracelet", quantity }] }, "INVALID_QUANTITY")
}
expectIndividualCode({ items: [{ productId: "inactive", quantity: 1 }] }, "INVALID_PRODUCT")
expectIndividualCode({ items: [{ productId: "does-not-exist", quantity: 1 }] }, "INVALID_PRODUCT")
expectIndividualCode({ items: [{ productId: "hamper-only", quantity: 1 }] }, "PRODUCT_NOT_FOR_INDIVIDUAL_SALE")
expectIndividualCode({ items: [{ productId: "no-price", quantity: 1 }] }, "PRODUCT_NOT_FOR_INDIVIDUAL_SALE")
const individualWithOffer = order.normalizeOrderInput({ ...individual, offerQuoteId: valid.idempotencyKey }, "Asia/Kolkata", individualCatalog)
assert(individualWithOffer.amountPaise === individualNormalized.amountPaise, "Individual offer quote changed server-derived cart pricing")
expectIndividualCode({ policyAccepted: false }, "POLICY_VERSION_MISMATCH")
expectIndividualCode({ idempotencyKey: "bad-key" }, "INVALID_IDEMPOTENCY_KEY")
expectIndividualCode({ address: "" }, "MISSING_REQUIRED_FIELDS")
expectIndividualCode({ requiredDate: "2026-02-31" }, "INVALID_REQUIRED_DATE")
expectIndividualCode({}, "PRODUCT_NOT_FOR_INDIVIDUAL_SALE", { salePricePaise: 0 })
expectIndividualCode({}, "PRODUCT_NOT_FOR_INDIVIDUAL_SALE", { salePricePaise: 100.5 })
expectIndividualCode({}, "PRODUCT_NOT_FOR_INDIVIDUAL_SALE", { salePricePaise: 2_147_483_647 })
const hugeCatalog = { ...individualCatalog, products: individualCatalog.products.slice(0, 3).map((product) => ({ ...product, sellIndividually: true, salePricePaise: 100_000_000 })) }
try {
  order.normalizeOrderInput({ ...individual, items: hugeCatalog.products.map((product) => ({ productId: product.id, quantity: 10 })) }, "Asia/Kolkata", hugeCatalog)
  throw new Error("Expected CART_AMOUNT_TOO_LARGE")
} catch (error) {
  if (error?.code !== "CART_AMOUNT_TOO_LARGE") throw error
}
const repriced = order.normalizeOrderInput({ ...individual, expectedSubtotalPaise: 105000 }, "Asia/Kolkata", { ...individualCatalog, products: individualCatalog.products.map((product) => product.id === "test-bracelet" ? { ...product, salePricePaise: 40000 } : product) })
assert(repriced.amountPaise === 105000 && individualNormalized.lineItems[0].unitPricePaise === 34950, "New purchase did not use current price or old snapshot mutated")
assert(order.orderCartKey(repriced) === order.orderCartKey(individualNormalized), "A price change should not change retry cart identity")
assert(order.orderCartKey({ ...repriced, lineItems: [...repriced.lineItems].reverse() }) === order.orderCartKey(repriced), "Cart identity depends on item order")
assert(order.orderCartKey({ ...repriced, lineItems: repriced.lineItems.map((item) => ({ ...item, quantity: item.quantity + 1 })) }) !== order.orderCartKey(repriced), "Same key could pay a different quantity")
assert(order.orderCartKey(normalized) !== order.orderCartKey(individualNormalized), "Same key could change purchase type")
assert(order.orderCartKey({ ...normalized, tierId: "t299" }) !== order.orderCartKey(normalized), "Same key could change hamper tier")

// These test-only keys and mocked responses never contact a payment provider.
Object.assign(process.env, {
  APP_BASE_URL: "http://127.0.0.1:3060", PAYMENT_MODE: "test",
  RAZORPAY_KEY_ID: "rzp_test_fixture", RAZORPAY_KEY_SECRET: "test-razorpay-key", RAZORPAY_WEBHOOK_SECRET: "test-razorpay-webhook",
  CASHFREE_APP_ID: "test-cashfree-app", CASHFREE_SECRET_KEY: "test-cashfree-key", CASHFREE_WEBHOOK_SECRET: "test-cashfree-webhook"
})
function loadProvider(name) {
  process.env.PAYMENT_PROVIDER = name
  for (const path of [join(out, "config", "env.js"), join(out, "config", "payment-gateway.js"), providerOutput]) delete require.cache[require.resolve(path)]
  return require(providerOutput)
}
function expectPaymentError(work, code) {
  try { work() } catch (error) { if (error.message === code) return }
  throw new Error(`Expected payment ${code}`)
}
const razorpay = loadProvider("razorpay")
const razorpayBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_fixture", order_id: "order_fixture", amount: 34950, status: "captured" } } } })
const razorpaySignature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(razorpayBody).digest("hex")
const razorpayHeaders = new Headers({ "x-razorpay-signature": razorpaySignature, "x-razorpay-event-id": "event_fixture" })
assert(razorpay.verifyProviderWebhook("razorpay", razorpayBody, razorpayHeaders).amountPaise === 34950, "Razorpay signed webhook amount changed")
expectPaymentError(() => razorpay.verifyProviderWebhook("razorpay", razorpayBody, new Headers()), "PAYMENT_WEBHOOK_SIGNATURE_INVALID")
expectPaymentError(() => razorpay.verifyProviderWebhook("razorpay", razorpayBody.replace("34950", "1"), razorpayHeaders), "PAYMENT_WEBHOOK_SIGNATURE_INVALID")
const returnSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update("order_fixture|pay_fixture").digest("hex")
const actualFetch = globalThis.fetch
let providerFetches = 0
globalThis.fetch = async () => { providerFetches += 1; return Response.json({ id: "pay_fixture", order_id: "order_fixture", amount: 34950, status: "captured" }) }
try {
  const returned = await razorpay.verifyProviderReturn({ provider: "razorpay", providerOrderId: "order_fixture", providerPaymentId: "pay_fixture", signature: returnSignature })
  assert(returned.status === "paid" && returned.amountPaise === 34950, "Verified Razorpay return lost server payment amount")
  try { await razorpay.verifyProviderReturn({ provider: "razorpay", providerOrderId: "order_fixture", providerPaymentId: "pay_fixture", signature: "invalid" }); throw new Error("Invalid signature accepted") }
  catch (error) { assert(error.message === "PAYMENT_SIGNATURE_INVALID", "Wrong payment return rejection") }
  assert(providerFetches === 1, "Invalid return signature contacted the payment provider")
  globalThis.fetch = async () => Response.json({ id: "pay_fixture", order_id: "another_order", amount: 34950, status: "captured" })
  try { await razorpay.verifyProviderReturn({ provider: "razorpay", providerOrderId: "order_fixture", providerPaymentId: "pay_fixture", signature: returnSignature }); throw new Error("Wrong provider order accepted") }
  catch (error) { assert(error.message === "PAYMENT_ORDER_MISMATCH", "Wrong provider order rejection") }
} finally { globalThis.fetch = actualFetch }
const cashfree = loadProvider("cashfree")
const cashfreeBody = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "cashfree_order_fixture", order_amount: 349.5 }, payment: { cf_payment_id: "cashfree_payment_fixture", payment_status: "SUCCESS", payment_amount: 349.5 } } })
const timestamp = "1700000000000"
const cashfreeSignature = createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET).update(`${timestamp}${cashfreeBody}`).digest("base64")
const cashfreeHeaders = new Headers({ "x-webhook-timestamp": timestamp, "x-webhook-signature": cashfreeSignature })
const cashfreeResult = cashfree.verifyProviderWebhook("cashfree", cashfreeBody, cashfreeHeaders)
assert(cashfreeResult.status === "paid" && cashfreeResult.amountPaise === 34950, "Cashfree signed webhook amount changed")
expectPaymentError(() => cashfree.verifyProviderWebhook("cashfree", cashfreeBody, new Headers()), "PAYMENT_WEBHOOK_SIGNATURE_INVALID")
expectPaymentError(() => cashfree.verifyProviderWebhook("cashfree", cashfreeBody.replace("349.5", "1"), cashfreeHeaders), "PAYMENT_WEBHOOK_SIGNATURE_INVALID")

await rm(out, { recursive: true, force: true })
console.log("Domain tests passed.")
