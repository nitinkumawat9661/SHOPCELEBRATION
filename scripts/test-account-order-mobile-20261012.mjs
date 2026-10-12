import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read=(name)=>readFile(new URL(`../${name}`, import.meta.url),"utf8")
const [account,styles,imports,journey,journeyCss,track,packageRaw]=await Promise.all([
  "features/account/CustomerAccountPage.tsx",
  "styles/account-order-cards-mobile-20261012.css",
  "app/globals.css",
  "features/tracking/CourierJourney.tsx",
  "styles/courier-journey.css",
  "features/tracking/TrackingPage.tsx",
  "package.json"
].map(read))

assert(styles.includes(".customerDashboard .customerOrderList>.customerOrderCard")&&
  styles.includes(".customerDashboard .customerOrderHead")&&
  styles.includes(".customerDashboard .customerOrderMeta")&&
  styles.includes(".customerDashboard .customerOrderFooter"),
  "Account mobile styling must be scoped to signed-in dashboard and real order-card regions")
assert(styles.includes(".customerDashboard .customerStats")&&
  styles.includes(".customerDashboard .customerDashToolbar"),
  "Keep summary counts and refresh control legible on phones")
assert(styles.includes("@media(max-width:639px)")&&
  styles.includes("@media(max-width:360px)")&&
  styles.includes("@media(max-width:850px)"),
  "Responsive cards must work across very small and normal phone viewports")
assert(styles.includes("grid-template-columns:repeat(2,minmax(0,1fr))")&&
  styles.includes("overflow-wrap:break-word")&&
  styles.includes("word-break:normal"),
  "Long order details should wrap naturally without card or page overflow")
assert(styles.includes("min-height:44px")&&styles.includes("min-height:49px")&&
  styles.includes(":focus-visible"),
  "Customer refresh/support/cancel/packing controls retain accessible touch and keyboard targets")
for (const protectedRegion of [
  ".courierJourneyCompact",".courierMilestonesCompact",".courierDot",
  ".celebrationTrackingPage",".celebrationCategories",".celebrationFeatured",
  "#builder",".cartPage",".paymentReturnPage"
]) assert(!styles.includes(protectedRegion),
  `Do not change previously approved parts of the site: ${protectedRegion}`)
assert(styles.includes(".customerPackingApproval")&&styles.includes(".customerOrderUpdates"),
  "Previously available packing approval and video cards should remain readable")
assert(styles.includes(".customerStatus.status-delivered")&&styles.includes(".customerStatus.status-cancelled"),
  "Status badges must remain conditional on actual returned order status")
assert(styles.includes("@media(prefers-reduced-motion:reduce)"),
  "Respect reduced motion")
assert(imports.includes('@import "../styles/account-order-cards-mobile-20261012.css";')&&
  imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Ship scoped account CSS, preserve protected jewelry stylesheet position")
assert(account.includes("routes.api.customerOrders")&&account.includes("loadOrders(true)")&&
  account.includes("orders.map((order) =>"),
  "Real authenticated order data and manual refresh are unchanged")
assert(account.includes("formatMoney(order.amountPaise / 100)")&&
  account.includes("customerPaymentStatusLabel(order.paymentStatus)")&&
  account.includes("orderStatusLabels[order.status]")&&
  account.includes("order.publicId"),
  "Order amounts, IDs, payment and status labels must come from real data")
assert(account.includes("!cancelled && <CourierJourney")&&
  account.includes("compact")&&account.includes("orderStatus={order.status}")&&
  journey.includes("if (compact)")&&journeyCss.includes(".customerOrderCard .courierMilestonesCompact"),
  "Preserve owner's approved exact single five-circle tracking display")
assert(account.includes("approvalReady &&")&&account.includes("approvePacking(order)")&&
  account.includes("canCancel &&")&&account.includes("cancelOrder(order)"),
  "Only eligible real orders may be packed/approved or cancelled")
assert(account.includes("supportWhatsappUrl(supportMessage, settings.whatsapp)")&&
  account.includes("onClick={() => loadOrders(true)}")&&
  account.includes("routes.paymentReturn"),
  "Support, refresh and pending payment recovery actions are intact")
assert(account.includes("DefaultAddressPanel")&&
  account.includes("CustomerAuthPanel")&&
  account.includes("accountState.logout()"),
  "Account authentication, default address and logout remain intact")
assert(track.includes('className="celebrationTrackingPage"')&&
  track.includes("formatDeliveryDate(order.requiredDate)"),
  "Previous step's standalone Tracking UI remains intact")
assert(packageRaw.includes("test-account-order-mobile-20261012.mjs"),
  "Validate signed-in order-card layout on every PR and production release")

console.log("My Orders UI guard passed: live order data, 5-circle courier, address, packing approval, cancellation, refresh, support, and mobile-friendly card layout.");
