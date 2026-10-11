import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [shipway, recover, sync, accountApi, trackApi, fulfillment, accountUi, accountSource] = await Promise.all([
  "lib/server/shipway.ts",
  "lib/server/orders/recover-shipment.ts",
  "lib/server/orders/courier-sync.ts",
  "app/api/account/orders/route.ts",
  "app/api/track/route.ts",
  "lib/server/orders/fulfillment.ts",
  "features/account/CustomerAccountPage.tsx",
  "lib/server/customer-accounts.ts"
].map(read))
const output = ts.transpileModule(shipway, { compilerOptions: {
  module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022
}}).outputText
const exportsRef = {}
vm.runInNewContext(output, {
  exports:exportsRef,
  require:()=>({ requireEnv:()=>"" }),
  Set, URL, Buffer, Date
})
const match = exportsRef.exactShipwayAwbForOrder
assert.equal(typeof match,"function")
const id = "CEL-261009-ABCD12345678"
assert.equal(match({orders:[{order_id:id, tracking_number:"AWB123456"}]}, id),"AWB123456")
assert.equal(match({data:[{orderid:id, awb_number:"1329900077"}]},id),"1329900077")
assert.equal(match({response:{order_id:id, awb_response:{AWB:"TEST-00011223"}}},id),"TEST-00011223")
assert.equal(match({orders:[{order_id:"CEL-261009-OTHER", tracking_number:"AWB123456"}]},id),null,"Wrong order identity cannot steal parcel")
assert.equal(match({orders:[{order_id:id+"-1",tracking_number:"AWB123456"}]},id),null,"Partial order ID not accepted")
assert.equal(match({orders:[{order_id:id, tracking_number:"AWB123456"},{order_id:id, tracking_number:"AWB999999"}]},id),null,"Ambiguous carrier records must fail closed")
assert.equal(match({orders:[{order_id:id,tracking_number:"ABC"}]},id),null,"Short or invalid AWB is unsafe")
assert.equal(match({orders:[{order_id:id,tracking_number:"AWB123456"},{order_id:"OTHER",tracking_number:"AWB999999"}]},id),"AWB123456")
assert.equal(match(null,id),null)
assert.equal(match({orders:[]},id),null)
assert.equal(match({orders:[{tracking_number:"AWB123456"}]},id),null,"A tracking number without exact order provenance cannot be attached")
assert(shipway.includes('/api/getorders?orderid='),"Use Shipway documented orderid parameter")
assert(!shipway.includes('/api/getorders?order_id='),"Do not pass unsupported parameter")
assert(sync.includes('recoverableStatus') && sync.includes('isPaid && recent') && sync.includes('45 * 24 * 60 * 60 * 1000'),
  "Check actual payment and recent paid order before attempting recovery")
assert(sync.includes('attachVerifiedShipwayAwb(order.publicId, confirmedAwb)'),
  "Do not link an AWB without exact merchant-order validation and DB transaction")
assert(sync.includes('recoverUnlinkedShipment !== false') && sync.includes('revalidate: 120'),
  "Avoid a carrier lookup flood during dashboard polling")
assert(recover.includes('pg_advisory_xact_lock') && recover.includes('FOR UPDATE'),
  "Recovered courier IDs must be saved with collision/race protection")
assert(recover.includes('shipping_tracking_number=$1 AND id<>$2'),
  "A courier AWB cannot be attached to another purchase already owning it")
assert(recover.includes("shipping_provider='Shipway'") && recover.includes("shipping_tracking_number=$1"),
  "Only provider/AWB should be linked")
assert(!recover.includes("status = 'shipped'") && !recover.includes("payment_status=") &&
  !recover.includes("UPDATE orders SET status"), "Attaching booking cannot alter order state")
assert(recover.includes('order.order_type === "hamper" && order.status === "preparing"'),
  "Never skip required hamper packing approval")
assert(accountApi.includes('shippingTrackingNumber: sync.trackingNumber'),
  "Account must return the newly recovered AWB without requiring a second visit")
assert(accountApi.includes('recoverUnlinkedShipment: index < 6'),
  "Bound the number of upstream recoveries attempted per signed-in list refresh")
assert(trackApi.includes('sync.trackingNumber !== order.shippingTrackingNumber') &&
  trackApi.includes('shippingTrackingNumber: sync.trackingNumber'),
  "Token-based tracking should re-read the newly attached AWB")
assert(accountApi.includes("item.shippingTrackingNumber !== orders[index].shippingTrackingNumber") &&
  accountApi.includes("const latest = await listCustomerOrders(account.id)") &&
  accountApi.includes("item.updatedAt = times.get(item.publicId) || item.updatedAt"),
  "Customer last-update time must reflect actual DB timestamp after new AWB/status")
assert(accountSource.includes("createdAt: row.created_at.toISOString()"),
  "Order age is grounded in actual DB order creation time")
assert(accountUi.includes("orderStatus={order.status}") && !accountUi.includes("Courier booked, awaiting pickup"),
  "Compact customer progress must not assert pickup occurred before live courier scan confirmation")
assert(fulfillment.includes('const shouldMarkShipped = metadata.markShipped === true'),
  "Entering an AWB or booking a courier must not automatically mark the parcel shipped")
assert(fulfillment.includes('markShipped: false'),
  "Shipway booking must stay at its preparation state until pickup scan")
console.log("Shipway missing-AWB recovery checks passed: strict order ID, ambiguity rejection, linked AWB only, payment/age/packing safety, bounded upstream calls, no premature shipped marking.")
