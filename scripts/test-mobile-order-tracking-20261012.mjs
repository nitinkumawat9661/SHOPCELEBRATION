import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import vm from "node:vm"

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),"utf8")
const [page,styles,globals,compact,journey,lookup,timeline,approval,issue,packageRaw]=await Promise.all([
  "features/tracking/TrackingPage.tsx",
  "styles/order-tracking-mobile-polish-20261012.css",
  "app/globals.css",
  "scripts/test-compact-account-tracking.mjs",
  "features/tracking/CourierJourney.tsx",
  "features/tracking/TrackingLookup.tsx",
  "features/tracking/TrackingTimeline.tsx",
  "features/tracking/PackingApprovalCard.tsx",
  "features/tracking/IssueForm.tsx",
  "package.json"
].map(read))

assert(page.includes('<main className="celebrationTrackingPage">'),"Scope presentation to /track only")
assert(page.includes("trackingHeroMain")&&page.includes("trackingHeroStatus")&&
  page.includes('role="status"'),"Display actual order status immediately after payment")
assert(page.includes("customerStatusLabel(order.status)")&&page.includes("customerPaymentStatusLabel(order.paymentStatus)"),
  "Customer-facing order and payment states must remain based on real API values")
assert(page.includes("{formatDeliveryDate(order.requiredDate)}") &&
  page.includes("{formatDeliveryDate(order.estimatedDeliveryDate)}"),
  "Show configured order-required-by date and verified courier estimate clearly")
assert(page.includes("fromMinorUnits(order.amountPaise)")&&page.includes("order.publicId"),
  "Order ID and paid/payable amount must remain exact live order data")
assert(page.includes('hash.get("order")')&&page.includes('url.searchParams.delete("token")')&&
  page.includes("window.history.replaceState"),"Private tracking token must remain in URL fragment, not query string")
assert(page.includes("<TrackingLookup />")&&page.includes("<TrackingTimeline")&&
  page.includes("<CourierJourney")&&page.includes("<PackingApprovalCard")&&page.includes("<IssueForm"),
  "Keep lookup, merchant timeline, real courier scans, approval and complaint flows")
assert(page.includes("onClick={() => void tracked.refresh()}")&&page.includes("copyTracking(order.shippingTrackingNumber!)"),
  "Current status refresh and tracking-number copy actions must remain accessible")
assert(page.includes('statusHasCapability(order.status, "issueReport")')&&
  page.includes('order.orderType === "hamper"')&&page.includes('onApprove={approve}'),
  "Do not show conditional issue/packing approval to ineligible orders")
assert(page.includes('order.status === "cancelled"')&&page.includes("order.estimatedDeliveryDate ?"),
  "No fabricated courier tracking/ETA when order is cancelled or not dispatched")

const match=page.match(/function customerStatusLabel\(status: OrderStatus\) \{[\s\S]*?\n\}/)
assert(match,"Tracking status label mapping must be testable")
const translated=ts.transpileModule(match[0],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const labels=vm.runInNewContext(`${translated}\ncustomerStatusLabel`)
for(const [status,label]of Object.entries({
  payment_verification_pending:"Confirming payment",
  payment_verified:"Confirmed",
  preparing:"Confirmed",
  packing_video_ready:"Packing video",
  customer_approved:"Packing video",
  shipped:"On the way",
  out_for_delivery:"Out for delivery",
  delivered:"Delivered",
  issue_reported:"Support in progress",
  refund_or_replacement_resolved:"Resolved",
  cancelled:"Cancelled"
}))assert.equal(labels(status),label,`Never mislabel actual order state: ${status}`)

assert(styles.includes(".celebrationTrackingPage .trackingHeroStatus")&&
  styles.includes(".celebrationTrackingPage .trackingMeta")&&
  styles.includes(".celebrationTrackingPage .trackingLookup"),"Track-only CSS covers order hero, facts and lookup")
assert(styles.includes(".courierJourney")&&styles.includes(".trackingLiveRefresh")&&
  styles.includes(".trackingTimelineMobile")&&styles.includes(".approvalCard")&&
  styles.includes(".issueCard"),"All original courier, packing and issue components remain readable")
assert(styles.includes("grid-template-columns:repeat(2,minmax(0,1fr))")&&
  styles.includes("@media(max-width:639px)")&&styles.includes("@media(max-width:360px)"),
  "Metadata and order lookup must fit mobile devices, including very narrow phones")
assert(styles.includes("min-height:49px")&&styles.includes("min-height:44px")&&
  styles.includes("font:400 16px/1.4"),"Tracking input fields must remain phone-accessible")
assert(styles.includes(":focus-visible")&&styles.includes("@media(prefers-reduced-motion:reduce)"),
  "Keep keyboard and reduced-motion support")
assert(!styles.includes(".customerOrderCard")&&!styles.includes(".cartPage")&&
  !styles.includes(".celebrationFeatured")&&!styles.includes(".celebrationCategories"),
  "Standalone tracking changes must not alter My Account's approved compact timeline or other shopping sections")
assert(globals.includes('@import "../styles/order-tracking-mobile-polish-20261012.css";')&&
  globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Ship tracking CSS and preserve protected jewelry listing import order")
assert(compact.includes("exactly five milestone")===false &&
  compact.includes("One compact status journey per active customer order"),
  "Existing account tracking regression remains present")
assert(journey.includes("if (compact)")&&journey.includes("courierMilestoneIndex(courier.stage)"),
  "Existing truth-based courier progress remains intact")
assert(lookup.includes("routes.api.trackingLookup")&&lookup.includes("validation.trackingLookupPhoneDigits"),
  "Server-authenticated order lookup still uses the original safe validation")
assert(timeline.includes("status === \"out_for_delivery\"")&&
  approval.includes('statusHasCapability(status, "packingVideoApproval")')&&
  issue.includes("routes.api.reportIssue"),
  "Keep real delivery milestones, packing permissions and issue reporting")
assert(packageRaw.includes("test-mobile-order-tracking-20261012.mjs"),
  "Order tracking UI regression is required in PR and VPS source audit")
console.log("Post-payment tracking UI checks passed: 11 correct order statuses, real courier data, protected lookup/packing/issue actions, mobile controls and unchanged My Account.")
