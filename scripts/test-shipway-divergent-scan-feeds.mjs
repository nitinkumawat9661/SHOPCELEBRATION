import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import vm from "node:vm"

const read = path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [parser,shipway,sync,cancel,journey,account,orders] = await Promise.all([
  "lib/domain/shipway-response.ts","lib/server/shipway.ts",
  "lib/server/orders/courier-sync.ts","lib/server/orders/cancel.ts",
  "features/tracking/CourierJourney.tsx",
  "features/account/CustomerAccountPage.tsx",
  "app/api/account/orders/route.ts"
].map(read))
const js=ts.transpileModule(parser,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exportsRef={}
vm.runInNewContext(js,{exports:exportsRef,Set,Date,URL,Math})
const {normalizeShipwayStatus,parseShipwayTrackingResponse,parseShipwayOrderByAwb,promotedShipwayStatus}=exportsRef
const AWB="153416250433281"
const other="OTHER-AWB-141"
const tracked = code=>({awb:AWB,tracking_details:{
  shipment_status:code,
  shipment_details:[{courier_name:"Shipway Xpressbees Express",current_status:"Exchange",order_id:"ORDER-A1"}],
  track_url:"https://app-v1.shipway.com/t/"+AWB
}})
const history=[
  {status:"Out For Delivery",location:"SIKAR, Rajasthan",timestamp:"2026-10-11 09:43:00",remarks:"Out for delivery"},
  {status:"Picked",location:"Sikar",timestamp:"2026-10-10 19:00:00"},
  {status:"Pickup Not Done",location:"Sikar",timestamp:"2026-10-10 14:27:00"},
  {status:"Out for Pickup",location:"Sikar",timestamp:"2026-10-10 13:10:00"},
  {status:"Data Received",location:"Sikar",timestamp:"2026-10-09 13:41:00"}
]
const data=tracked("SCH")
data.tracking_details.tracking_history=history
let parsed=parseShipwayTrackingResponse([data],AWB)
assert.equal(parsed.shipmentStatus,"OOD","Newer OFD scan overrides stale booked code")
assert.equal(parsed.scans.length,5,"All real history events retained")
assert.equal(parsed.scans[0].location,"SIKAR, Rajasthan")
assert.equal(parsed.courierName,"Shipway Xpressbees Express")
assert.equal(parsed.trackUrl,"https://app-v1.shipway.com/t/"+AWB)
assert.equal(parsed.scans[2].status,"Pickup Not Done")
assert.equal(parseShipwayTrackingResponse([data],other),null,"Wrong AWB must never be used")
const metadataOnly=tracked("SCH")
parsed=parseShipwayTrackingResponse([metadataOnly],AWB)
assert.equal(parsed.shipmentStatus,"SCH")
assert.equal(parsed.scans.length,0,"shipment_details 'Exchange' is metadata, not a real scan")
assert.equal(normalizeShipwayStatus("Exchange"),"","Exchange must not be interpreted as dispatch")
assert.equal(normalizeShipwayStatus("Out For Delivery"),"OOD")
assert.equal(normalizeShipwayStatus("Pickup Not Done"),"PKF")
assert.equal(normalizeShipwayStatus("Picked"),"PKP")
assert.equal(normalizeShipwayStatus("Shipped"),"INT")
assert.equal(normalizeShipwayStatus("Delivered"),"DEL")
assert.equal(normalizeShipwayStatus("Undelivered"),"UND")
assert.equal(promotedShipwayStatus("SCH","OOD"),"OOD")
assert.equal(promotedShipwayStatus("OOD","SCH"),"OOD")
assert.equal(promotedShipwayStatus("INT","DEL"),"DEL")
assert.equal(promotedShipwayStatus("SCH","Exchange"),"SCH")
const orderLookUp={orders:[
  {awb_number:other,shipment_status:"DEL",current_status:"Delivered"},
  {order_tracking_number:AWB,shipment_status:"SCH",new_shipment_status:"OOD",current_status:"Out for Delivery"}
]}
let fallback=parseShipwayOrderByAwb(orderLookUp,AWB)
assert.equal(fallback.shipmentStatus,"OOD","Authoritative AWB-linked order status backs up stale tracking endpoint")
assert.equal(parseShipwayOrderByAwb(orderLookUp,"not-found"),null,"Never read another parcel")
assert.equal(parseShipwayOrderByAwb({orders:[{awb_number:other,shipment_status:"DEL"}]},AWB),null)
assert.equal(parseShipwayOrderByAwb({orders:[{order_id:"ORDER-A1",shipment_status:"DEL"}]},AWB),null,
 "A mere merchant order ID without a matching AWB is not courier delivery evidence")
const nested=parseShipwayOrderByAwb({response:[{order_id:"ORDER-A1",awb_response:{AWB:AWB},shipment_status:"OFD"}]},AWB)
assert.equal(nested.shipmentStatus,"OFD","Nested matched AWB permits exact-order shipping status")
const conflict=tracked("INT")
conflict.tracking_details.tracking_history=[{status:"Exchange"}]
assert.equal(parseShipwayTrackingResponse([conflict],AWB).scans.length,0,"Undated order metadata cannot fake courier scans")
const confirmed=tracked("DEL")
assert.equal(parseShipwayTrackingResponse([confirmed],AWB).shipmentStatus,"DEL","Never downgrade delivered carrier result")

// Verify deployed paths really use the tested helper.
assert(shipway.includes("parseShipwayTrackingResponse(raw, awb)"))
assert(shipway.includes("parseShipwayOrderByAwb(orderRaw, awb)"))
assert(shipway.includes("promotedShipwayStatus(primaryStatus, fallback?.shipmentStatus"),"Stale SCH must merge with newer exact-AWB status")
assert(shipway.includes("/api/getorders?awb_number="), "Use authenticated read-only order endpoint")
assert(shipway.includes("/api/tracking?awb_numbers="), "Use authenticated scan endpoint")
assert(sync.includes("courierProgressStatus(live?.shipmentStatus"),"Map combined current scan status")
assert(cancel.includes("confirmedPrePickup") && cancel.includes("SHIPWAY_CANCELLATION_UNAVAILABLE"),
  "Never cancel a potentially out-for-delivery order on stale or unknown provider status")
assert(account.includes('unconfirmedBookingFeed')===false && journey.includes("unconfirmedBookingFeed"),
  "Stale API needs a customer-visible caution")
assert(journey.includes('courier.code === "OOD"') && journey.includes('courier.code === "OFD"') && account.includes("orderStatus={order.status}"),"Compact My Account status must use real courier OFD/OOD codes and current order status")
assert(account.includes('order.courier.scans.some('),"Hide unsafe cancellation buttons when courier scans missing")
assert(orders.includes("syncOrderCourier(order"),"Customer dashboard must retain courier sync")
console.log("Shipway divergent feeds passed: actual 5-scan OFD, stale SCH metadata-only Exchange, exact-AWB /getorders promotion, cancelled/stale order safety and customer UI.")
