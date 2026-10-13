import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [account,component,css,globalCss,unread,privateApi]=await Promise.all([
 "features/account/CustomerAccountPage.tsx",
 "features/account/OrderCelebrationMessages.tsx",
 "styles/telegram-order-messages.css",
 "app/globals.css",
 "app/api/account/orders/message-unread/route.ts",
 "app/api/account/orders/[publicId]/messages/route.ts"
].map(read))
assert(account.includes("<OrderCelebrationMessages")&&account.includes("orderId={order.publicId}"),"Per-order UI only")
for(const expected of ["!cancelled && <CourierJourney","approvePacking(order)","cancelOrder(order)","packingVideoUrl","supportWhatsappUrl","routes.paymentReturn"])
 assert(account.includes(expected),"Do not break existing My Orders: "+expected)
assert(account.includes("ordersOwnerId === accountId")&&account.includes("activeAccountRef.current !== ownerId"),"Do not show previous buyer's cached orders")
assert(account.includes("message-unread")&&account.includes('cache: "no-store"'),"Unread refresh scoped to normal account refresh")
assert(unread.includes("getCustomerSession")&&unread.includes("o.customer_account_id = $1")&&unread.includes("m.read_at IS NULL")&&unread.includes("LIMIT 200"),"Authenticated bounded unread counts")
assert(unread.includes("private, no-store")&&!unread.includes("m.body"),"Unread counts must not expose messages")
for(const expected of ["aria-expanded","aria-controls","cache: \"no-store\"","response.ok","setState(\"ready\")","state !== \"ready\"","method: \"POST\"","dateStyle: \"medium\"","Asia/Kolkata","<p>{message.body}</p>"])
 assert(component.includes(expected),"Messaging UI: "+expected)
assert(!component.includes("dangerouslySetInnerHTML")&&!component.includes("textarea")&&!component.includes("<form"),"No unsafe HTML or buyer composer")
assert(css.includes("@media(max-width:360px)")&&css.includes("overflow-wrap:anywhere")&&css.includes(":focus-visible"),"Mobile and keyboard styles")
assert(globalCss.includes("telegram-order-messages.css"),"Style must be shipped")
assert(privateApi.includes("getCustomerSession")&&privateApi.includes("enforceSameOrigin(request)")&&privateApi.includes("private, no-store"),"Per-order buyer message security")
console.log("TELEGRAM_CUSTOMER_UI_SOURCE_CHECKS_PASSED")
