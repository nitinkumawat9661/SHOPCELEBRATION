import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import vm from "node:vm"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const files = await Promise.all([
  "lib/domain/courier-tracking.ts",
  "lib/server/orders/courier-sync.ts",
  "lib/server/shipway.ts",
  "app/api/track/route.ts",
  "app/api/account/orders/route.ts",
  "features/tracking/useTrackedOrder.ts",
  "features/tracking/TrackingPage.tsx",
  "features/tracking/CourierJourney.tsx",
  "features/account/CustomerAccountPage.tsx",
  "styles/courier-journey.css",
  "app/globals.css"
].map(read))
const [src,sync,shipway,trackApi,accountApi,hook,trackPage,journey,accountPage,css,globals] = files

const exportsRef = {}
const js = ts.transpileModule(src,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText
vm.runInNewContext(js,{exports:exportsRef,Date,Set})
const { courierProgressStatus, displayCourierStatus, courierMilestoneIndex } = exportsRef
const statuses = {
  SCH:null,OFP:null,NFI:null,NFIDS:null,PKF:null,PCAN:null,CAN:null,
  DEX:null,DRE:null,UND:null,SMD:null,CRTA:null,ODA:null,
  PKP:"shipped",INT:"shipped",OOD:"out_for_delivery",
  OFD:"out_for_delivery",DEL:"delivered"
}
for(const [code,expected] of Object.entries(statuses)){
  assert.equal(courierProgressStatus(code),expected,`Verified courier code mapping: ${code}`)
}
const fresh = (code, extras={}) => ({
  shipmentStatus:code,currentStatus:"",courierName:"Courier",
  trackUrl:"https://example.org/tracking",estimatedDeliveryDate:"2026-10-12",
  scans:[],...extras
})
assert.equal(displayCourierStatus(null,"preparing","AWB-1234"),null,"Failed carrier query must not invent pickup")
assert.equal(displayCourierStatus(fresh("SCH"),"preparing","AWB-1234").stage,"pickup_requested")
assert.equal(displayCourierStatus(fresh("OFP"),"preparing","AWB-1234").stage,"pickup_requested")
assert.equal(displayCourierStatus(fresh("PKP"),"preparing","AWB-1234").stage,"picked_up")
assert.equal(displayCourierStatus(fresh("INT"),"shipped","AWB-1234").stage,"in_transit")
assert.equal(displayCourierStatus(fresh("OOD"),"shipped","AWB-1234").stage,"out_for_delivery")
assert.equal(displayCourierStatus(fresh("DEL"),"shipped","AWB-1234").stage,"delivered")
assert.equal(displayCourierStatus(fresh("PKF"),"preparing","AWB-1234").stage,"exception")
assert.equal(displayCourierStatus(fresh("RTO"),"shipped","AWB-1234").stage,"returning")
assert.equal(displayCourierStatus(fresh("CAN"),"preparing","AWB-1234").label,"Courier shipment cancelled")
assert.equal(displayCourierStatus(fresh("SCH"),"shipped","AWB-1234").stage,"pickup_requested","An AWB and internal shipped label do not prove courier pickup")
assert.equal(displayCourierStatus(fresh("DEL"),"cancelled","AWB-1234"),null,"Do not resurrect cancelled order")
const scans=[
  { status:"In transit",location:"Jaipur Sorting Hub",occurredAt:"2026-10-11 08:00",details:"Scanned at facility" },
  { status:"Picked up",location:"Sikar",occurredAt:"2026-10-10 17:00",details:null }
]
const displayed=displayCourierStatus(fresh("INT",{scans}),"shipped","AWB-1234")
assert.equal(displayed.lastLocation,"Jaipur Sorting Hub")
assert.equal(displayed.latestScanAt,"2026-10-11 08:00")
assert.equal(displayed.scans.length,2)
assert.equal(courierMilestoneIndex("out_for_delivery"),3)
assert.equal(courierMilestoneIndex("exception"),-1)
for(const c of [
  '"shipped"','"out_for_delivery"','"delivered"',
  'isPaid &&','order.orderType === "individual"',
  'status === "customer_approved"',
  'await updateOrderStatus','courierProgressStatus','getShipwayTracking',
]) assert(sync.includes(c),`Missing safe status reconciliation: ${c}`)
assert(!sync.includes('advance("cancelled")'),"Courier cancellation must not refund/cancel the purchase")
assert(sync.includes('courier: null, courierUnavailable: false'),"Non-Shipway bookings cannot use invented Shipway data")
assert(shipway.includes("tracking_history=1"),"Request real scan history")
assert(shipway.includes("current_status_code"),"Support status-code response variant")
assert(shipway.includes("parseShipwayTrackingResponse") && shipway.includes("parseShipwayOrderByAwb"),"Parse carrier shipment details and exact-AWB order feed in shared helpers")
assert(trackApi.includes("syncOrderCourier(order)") && accountApi.includes("syncOrderCourier(order, { recoverUnlinkedShipment: index < 6 })"),
  "Both signed-in and token tracking must reconcile the very same courier scans")
assert(trackApi.includes('Cache-Control": "private, no-store"'),"Token results must not be cached")
assert(accountApi.includes('Cache-Control": "no-store"'),"Account results must not be cached")
assert(!trackApi.includes('["PKP", "INT", "UND"'),"Never mark shipped on failed-delivery or booking signal")
assert(hook.includes("60000") && hook.includes("visibilitychange") && hook.includes('window.addEventListener("online"'),
  "Tracking page must poll while visible and refresh on reconnect")
assert(accountPage.includes("60000") && accountPage.includes("visibilitychange"),"Account orders must poll for live updates")
assert(trackPage.includes("<CourierJourney") && accountPage.includes("<CourierJourney"),"Both UIs render shipment stages")
assert(journey.includes("Courier scan history") && journey.includes("Arriving today (expected)") &&
  journey.includes("not continuous GPS") && src.includes('label: "Pickup requested"'),
  "Show truthful ETA/scan details and no claimed continuous GPS")
assert(css.includes("@media(max-width:700px)") && css.includes(".courierMilestones"),
  "Real courier journey must adapt to mobile widths")
assert(globals.includes('@import "../styles/courier-journey.css";'),"New component styling must be loaded")
console.log("Real courier tracking checks passed: 17+ status examples; booking vs pickup, in transit/OFD/DEL, exception safety, genuine scan locations, shared account/token sync, mobile polling and no fabricated stage.")
