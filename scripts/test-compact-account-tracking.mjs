import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import vm from "node:vm"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [account, journey, css, fullPage, accountApi] = await Promise.all([
  "features/account/CustomerAccountPage.tsx",
  "features/tracking/CourierJourney.tsx",
  "styles/courier-journey.css",
  "features/tracking/TrackingPage.tsx",
  "app/api/account/orders/route.ts"
].map(read))

// Removal is scoped to My Account; the merchant and detailed /track workflow
// must continue to expose actual courier scans and tracking links.
for (const deleted of [
  "customerProgressDesktop", "customerProgressMobile",
  "Tracking timeline", "<span>Shipping</span>",
  'copyTracking(', 'formatDeliveryDate(',
  "customerEta", "shippingActions"
]) assert(!account.includes(deleted), `Duplicate account UI remains: ${deleted}`)
assert(account.includes("<CourierJourney") && account.includes("compact") &&
  account.includes("orderStatus={order.status}"), "One compact status journey per active customer order")
assert(account.includes("!cancelled && <CourierJourney"), "Cancelled orders should not show active shipment journey")
assert(account.includes('className="customerOrderMeta"') &&
  account.includes("customerPaymentStatusLabel(order.paymentStatus)") &&
  account.includes("checkoutProgressNote"), "Preserve core paid, order details, and next action")
assert(account.includes("approvalReady &&") && account.includes("approvePacking(order)") &&
  account.includes("canCancel &&") && account.includes("cancelOrder(order)") &&
  account.includes('WhatsApp support'), "Keep hamper approval, cancellation and support")
assert(account.includes('!individual && <div className="customerOrderUpdates">') &&
  account.includes("Watch video"), "Hamper packing video remains accessible")
assert(!account.includes('<div className="customerOrderUpdates">\n                <div className="customerUpdateCard"><span>Shipping'), "Do not show duplicated shipping panel")
assert(accountApi.includes("syncOrderCourier(") && accountApi.includes("courier: sync.courier"),
  "Do not modify the live API or courier synchronization")
assert(fullPage.includes("<CourierJourney") && !fullPage.includes(" compact"),
  "Dedicated tracking still has full detailed carrier information")

// Execute the actual TSX view function using a JSX tree shim. Inspect the
// resulting component tree instead of relying only on a source string check.
const moduleExports = {}
const compiled = ts.transpileModule(journey, {
  compilerOptions: { target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS,
    jsx:ts.JsxEmit.ReactJSX }
}).outputText
const createNode = (type, props, key) => ({type, props:props||{}, key})
const steps = [
  {stage:"pickup_requested",label:"Pickup requested"},{stage:"picked_up",label:"Picked up"},
  {stage:"in_transit",label:"In transit"},{stage:"out_for_delivery",label:"Out for delivery"},
  {stage:"delivered",label:"Delivered"}
]
vm.runInNewContext(compiled,{
  exports:moduleExports,
  require: id => {
    if(id==="react/jsx-runtime")return {jsx:createNode,jsxs:createNode}
    if(id==="../../lib/domain/courier-tracking")return {
      COURIER_MILESTONES:steps,
      courierMilestoneIndex: stage=>steps.findIndex(x=>x.stage===stage)
    }
    throw Error("Unexpected runtime import "+id)
  }
})
const render = props => moduleExports.CourierJourney(props)
function listNodes(node, acc=[]) {
  if(!node || typeof node!=="object")return acc
  acc.push(node)
  for(const child of Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]){
    if(Array.isArray(child)) child.forEach(c=>listNodes(c,acc))
    else listNodes(child,acc)
  }
  return acc
}
function getText(node) {
  if(node==null||typeof node==="boolean")return ""
  if(typeof node!=="object")return String(node)
  const v=node.props?.children
  return (Array.isArray(v)?v:[v]).map(getText).join(" ")
}
function assertCompact(props, heading, reached) {
  const root=render({courier:null,compact:true,unavailable:false,...props})
  const nodes=listNodes(root)
  assert(nodes[0].props.className.includes("courierJourneyCompact"),"Correct lightweight view must render")
  assert.equal(nodes.filter(n=>n.type==="li").length,5,"Exactly five milestone circles")
  assert.equal(nodes.filter(n=>n.type==="a"||n.type==="details"||n.type==="summary").length,0,
    "No Open Tracking link, shipping panel, or expandable scan history")
  const text=getText(root)
  assert(text.includes(heading),`Headline must follow real state: ${heading}`)
  assert(text.includes("Placed")&&text.includes("Picked up")&&
    text.includes("In transit")&&text.includes("Out for delivery")&&
    text.includes("Delivered"),"Approved 5-step caption format")
  for(const removed of ["Open courier tracking","Courier scan history","Updates come from courier scans",
    "Estimated delivery:","Last reported location:","Shipway Xpressbees"]){
    assert(!text.includes(removed),`Verbose content must not be in account compact view: ${removed}`)
  }
  assert.equal(nodes.filter(n=>n.type==="li"&&n.props.className==="reached").length,reached,
    "Completed stages must be based on actual courier data rather than time")
  return root
}
const live = stage => ({
  stage,code:stage==="out_for_delivery"?"OOD":stage==="delivered"?"DEL":"SCH",
  label:stage==="delivered"?"Delivered":"Pickup requested",
  description:"This paragraph must not be rendered in compact mode",
  courierName:"Shipway Xpressbees",scans:[],
  latestScanAt:null,lastLocation:"Sikar",checkedAt:"2026-10-11T04:15:00Z",
  estimatedDeliveryDate:"2026-10-11",trackUrl:"https://example.org/track"
})
assertCompact({courier:live("out_for_delivery"),orderStatus:"out_for_delivery"},"Arriving today (expected)",4)
assertCompact({courier:live("delivered"),orderStatus:"delivered"},"Delivered",5)
assertCompact({orderStatus:"preparing"},"Preparing your order",1)
assertCompact({orderStatus:"payment_verification_pending"},"Payment confirmation pending",1)
assertCompact({orderStatus:"shipped"},"Shipped — awaiting courier scans",1)
assertCompact({orderStatus:"delivered"},"Delivered",5)
assertCompact({orderStatus:"preparing",unavailable:true},"Tracking temporarily unavailable",1)
const exception=live("exception")
exception.code="UND"; exception.label="Delivery attempt unsuccessful"
assertCompact({courier:exception,orderStatus:"shipped"},"Delivery attempt unsuccessful",0)
const exceptionTree=render({courier:exception,compact:true})
assert(listNodes(exceptionTree).some(n=>n.props.role==="status"&&getText(n).includes("courier exception")),
  "Do not suppress a real delivery issue in the compact display")
// Full /track view must still offer scans and the courier's tracking link.
const full=render({courier:{...live("out_for_delivery"),scans:[
  {status:"Out for delivery",location:"Sikar",occurredAt:"2026-10-11 09:43",details:null}
]},compact:false})
assert(listNodes(full).some(n=>n.type==="a"),"Detailed tracking link must survive on /track")
assert(listNodes(full).some(n=>n.type==="details"),"Scan history must survive on /track")
assert(css.includes(".customerOrderCard .courierMilestonesCompact") &&
  css.includes("grid-template-columns:repeat(5,minmax(0,1fr))") &&
  css.includes("@media(max-width:380px)"),"Compact responsive 5-column layout at narrow widths")
assert(!css.includes("display:none!important"),"No brute-force hiding of data to simulate cleanup")
console.log("Compact customer tracking passed: one five-circle status card, truthful API-driven stages, no duplicate shipping/timeline/link, preserved packing and admin-safe actions; full /track details retained.")
