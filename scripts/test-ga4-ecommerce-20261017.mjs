import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const source = readFileSync(new URL("../features/analytics/ga4.ts", import.meta.url), "utf8")
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const events = []
function store() {
  const values = new Map()
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
}
const localStorage = store()
const sessionStorage = store()
const window = {
  dataLayer: [],
  gtag: (...args) => events.push(args),
  localStorage,
  sessionStorage
}
const module = { exports: {} }
runInNewContext(js, {
  module, exports: module.exports, window,
  require: (name) => {
    assert.equal(name, "../../config/public-env")
    return { publicEnv: { ga4MeasurementId: "G-TEST123" } }
  }
})
const api = module.exports
const item = { item_id: "sku-1", item_name: "Necklace", price: 149, quantity: 2 }
const purchase = { transaction_id: "ORDER-1", value: 298, currency: "INR", shipping: 0, items: [item] }

api.trackGa4ViewItem(item)
api.trackGa4AddToCart(item)
api.trackGa4RemoveFromCart({ ...item, quantity: 1 })
api.trackGa4BeginCheckout([item], 298)
api.trackGa4AddShippingInfo([item], 298)
assert.equal(api.trackGa4AddPaymentInfo(purchase, "cashfree"), true)
assert.equal(api.trackGa4AddPaymentInfo(purchase, "cashfree"), false, "Payment info should not duplicate for retries")
assert.equal(api.trackGa4Purchase(purchase), true)
assert.equal(api.trackGa4Purchase(purchase), false, "A successful payment should be reported once per browser")
assert.equal(api.trackGa4Purchase({ ...purchase, transaction_id: "", value: 298 }), false)
assert.deepEqual(events.map(([eventType, name]) => (assert.equal(eventType, "event"), name)), [
  "view_item", "add_to_cart", "remove_from_cart", "begin_checkout",
  "add_shipping_info", "add_payment_info", "purchase"
])
const pay = events.find(([, name]) => name === "purchase")[2]
assert.equal(pay.transaction_id, "ORDER-1")
assert.equal(pay.value, 298)
assert.equal(pay.shipping, 0)
assert.equal(pay.currency, "INR")
assert.equal(pay.items[0].item_brand, "Celebration")
assert.ok(!("email" in pay) && !("phone" in pay) && !("address" in pay))
const sourceCheckout = readFileSync(new URL("../features/checkout/useOrderSubmit.ts", import.meta.url), "utf8")
assert.match(sourceCheckout, /if \(result\?\.paid && result\.analyticsPurchase\) trackGa4Purchase/)
assert.match(sourceCheckout, /trackGa4AddPaymentInfo\(started\.analyticsPurchase, started\.checkout\.provider\)/)
console.log("PASS: GA4 ecommerce event payloads, payment dedupe and verified-purchase guard")
