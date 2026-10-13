import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [account,header,link,page,center,css,globals,index,unread,send,privateApi,service]=await Promise.all([
  "features/account/CustomerAccountPage.tsx",
  "features/shell/StorefrontHeader.tsx",
  "features/shell/NotificationLink.tsx",
  "app/notifications/page.tsx",
  "features/account/NotificationCenter.tsx",
  "styles/notifications-center.css",
  "app/globals.css",
  "app/api/account/notifications/route.ts",
  "app/api/account/orders/message-unread/route.ts",
  "app/api/account/orders/[publicId]/messages/send/route.ts",
  "app/api/account/orders/[publicId]/messages/route.ts",
  "lib/server/telegram-order-messages.ts"
].map(read))
assert(!account.includes("<OrderCelebrationMessages"),"Remove old per-order messaging accordion")
assert(account.includes("/notifications?order="),"My Orders support links to central inbox")
for(const s of ["!cancelled && <CourierJourney","approvePacking(order)","cancelOrder(order)","packingVideoUrl","supportWhatsappUrl","routes.paymentReturn"])
 assert(account.includes(s),"Existing My Orders must remain: "+s)
assert(header.indexOf("<NotificationLink />")>0&&header.indexOf("<NotificationLink />")<header.indexOf("<CartLink />"),"Bell next to cart")
assert(link.includes("celebrationNotificationCount")&&link.includes("message-unread")&&link.includes("celebration:auth-changed"),"Header unread badge")
assert(page.includes("<NotificationCenter />")&&page.includes("index: false"),"Dedicated private page")
assert(center.includes("CustomerAuthPanel")&&center.includes("getAccount")===false,"Guest login only")
assert(center.includes("crypto.randomUUID()")&&center.includes("requestId"),"Client message send must be idempotent")
assert(center.includes("aria-live")&&center.includes("aria-pressed")&&center.includes("notificationComposer"),"Accessible chat")
assert(center.includes("<p>{message.body}</p>")&&!center.includes("dangerouslySetInnerHTML"),"Plain text XSS defense")
assert(center.includes("Asia/Kolkata")&&center.includes("AbortController")&&center.includes("accountId"),"Local timestamps and account isolation")
assert(css.includes("@media(max-width:360px)")&&css.includes("overflow-wrap:anywhere")&&css.includes(":focus-visible"),"Small mobile and keyboard UX")
assert(globals.includes('notifications-center.css')&&!globals.includes('telegram-order-messages.css'),"New styles replace old")
assert(index.includes("getCustomerSession")&&index.includes("o.customer_account_id=$1")&&index.includes("LIMIT 100")&&index.includes("private, no-store"),"Order-bound index")
assert(unread.includes("m.sender = 'celebration_support'")&&unread.includes("o.customer_account_id = $1"),"Unread replies only")
assert(send.includes("getCustomerSession")&&send.includes("enforceSameOrigin")&&send.includes("consumeRateLimit")&&send.includes("readJsonBody"),"Protected rate-limited text send")
assert(privateApi.includes("getCustomerSession")&&privateApi.includes("enforceSameOrigin(request)")&&privateApi.includes("private, no-store"),"Secure original read ack")
assert(service.includes("ON CONFLICT (client_message_id) DO NOTHING")&&service.includes("customer_account_id=$2"),"Scoped idempotent send")
console.log("TELEGRAM_NOTIFICATION_CENTER_TESTS_PASSED")
