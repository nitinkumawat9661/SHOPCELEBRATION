import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const source = await readFile(new URL("../features/cart/cart.ts", import.meta.url), "utf8")
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { parseCart, cartKey, removePurchasedItems } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
const raw = (items) => JSON.stringify({ v: 1, items })
assert.deepEqual(parseCart(raw([{ productId: "bracelet", quantity: 2, price: 1 }])), [{ productId: "bracelet", quantity: 2 }])
for (const input of [null, "invalid", JSON.stringify({ v: 2, items: [] }), raw([{ productId: "../x", quantity: 1 }]), raw([{ productId: "bracelet", quantity: 0 }]), raw([{ productId: "bracelet", quantity: 11 }]), raw([{ productId: "bracelet", quantity: 1.2 }]), raw([{ productId: "bracelet", quantity: "1" }]), raw([{ productId: "bracelet", quantity: 1 }, { productId: "bracelet", quantity: 2 }]), raw(Array.from({ length: 21 }, (_, i) => ({ productId: `item-${i}`, quantity: 1 })))]) assert.deepEqual(parseCart(input), [])
const items = [{ productId: "b", quantity: 1 }, { productId: "a", quantity: 2 }]
assert.equal(cartKey(items), cartKey([...items].reverse()))
assert.deepEqual(items.map((item) => item.productId), ["b", "a"])
assert.deepEqual(removePurchasedItems(items, [{ productId: "a", quantity: 1 }]), [{ productId: "b", quantity: 1 }, { productId: "a", quantity: 1 }])
assert.deepEqual(removePurchasedItems(items, [{ productId: "b", quantity: 1 }, { productId: "a", quantity: 3 }]), [])
console.log("Cart passed: strict ID/quantity bounds, duplicate rejection, no persisted prices and stable checkout key.")

const addToCartSource = await readFile(new URL("../features/cart/AddToCart.tsx", import.meta.url), "utf8")
assert.match(addToCartSource, /catalogInlineQuantity/, "Product card must render an inline cart quantity control after add")
assert.match(addToCartSource, /cart\.quantity\(/, "Inline cart state must update the shared cart quantity")
assert.match(addToCartSource, /cart\.remove\(/, "Inline decrement must be able to remove the final item")

const cashfreeClientSource = await readFile(new URL("../features/checkout/useOrderSubmit.ts", import.meta.url), "utf8")
assert.match(cashfreeClientSource, /cashfreeRedirectTarget/, "Cashfree checkout must choose a device-safe redirect target")
assert.match(cashfreeClientSource, /\? "_self" : "_modal"/, "Mobile Cashfree checkout must support current-tab redirect")
const paymentProviderSource = await readFile(new URL("../lib/server/payments/provider.ts", import.meta.url), "utf8")
assert.match(paymentProviderSource, /\/payment\/return\?provider_order_id=\{order_id\}/, "Cashfree return URL must land directly on the payment status route")
console.log("Marketplace cart/payment UX checks passed: inline quantity state and direct mobile payment return are wired.")

// Exercise the actual submit hook without a browser, database or provider request.
const hookSource = await readFile(new URL("../features/checkout/useOrderSubmit.ts", import.meta.url), "utf8")
const hookJs = ts.transpileModule(hookSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const slots = [], effects = [], requests = []
let cursor = 0, validations = 0
const hookReact = {
  useRef(value) { const index = cursor++; return slots[index] ||= { current: value } },
  useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next }] },
  useEffect(effect) { if (!effects.length) effects.push(effect) }
}
const routes = { api: { paymentConfig: "/config", paymentCreate: "/create", paymentRetry: "/retry" } }
const dependencies = {
  react: hookReact,
  "../../config/order": { orderConfig: { policyVersion: "test" } },
  "../../lib/domain/content": { errorMessages: {}, storeContent: {}, uiContent: {} },
  "../../lib/domain/catalog": {}, "../../lib/domain/support": {},
  "../../config/routes": { routes },
  "../builder/validation": { validateCheckoutDetails(details) { validations++; return details.requiredDate === "expired" ? "Expired date" : "" }, validatePaymentReference() { return "" } }
}
const hookExports = {}
new Function("require", "exports", hookJs)((name) => { assert(name in dependencies, `Unexpected hook dependency: ${name}`); return dependencies[name] }, hookExports)
const renderHook = () => { cursor = 0; return hookExports.useOrderSubmit() }
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async (url, options) => {
    if (url === "/config") return { json: async () => ({ enabled: true, provider: "razorpay" }) }
    requests.push({ url, body: JSON.parse(options.body) })
    const order = { orderId: "TEST-SAVED", payablePaise: 999, trackingToken: "test-token", trackingPath: "/track?token=test-token" }
    return url === "/create" ? { ok: false, json: async () => ({ ...order, ok: false, error: "PAYMENT_PROVIDER_UNAVAILABLE" }) } : { ok: true, json: async () => ({ ...order, ok: true, paid: true }) }
  }
  renderHook()
  effects[0]()
  await new Promise(setImmediate)
  let hook = renderHook()
  const args = { orderType: "individual", items: [{ productId: "bracelet", quantity: 1 }], expectedSubtotalPaise: 999, selectedNames: ["Bracelet"], accepted: true, checkout: { requiredDate: "valid", city: "Test City", state: "Test State" } }
  assert.equal(await hook.pay(args), null)
  hook = renderHook()
  assert.equal(hook.paymentOrderId, "TEST-SAVED", "Provider failure must retain the already saved order")
  assert.equal(hook.orderTotalPaise, 999)
  const validationCount = validations
  assert.equal((await hook.pay({ ...args, checkout: { ...args.checkout, requiredDate: "expired" } })).orderId, "TEST-SAVED")
  assert.equal(validations, validationCount, "Saved retry must not revalidate an immutable delivery date after midnight")
  assert.deepEqual(requests.map((request) => request.url), ["/create", "/retry"])
  assert.deepEqual(requests[1].body, { publicOrderId: "TEST-SAVED" }, "Retry must use the stored order, not current catalog prices or edited delivery details")
  console.log("Checkout recovery passed: provider failure retains the saved order; retry uses its identity and immutable total.")
} finally { globalThis.fetch = originalFetch }
