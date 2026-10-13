import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"

const read = (file) => readFile(new URL("../" + file, import.meta.url), "utf8")
const files = await Promise.all([
  "db/migrations/100_telegram_notification_outbox.sql",
  "db/migrations/101_telegram_order_messaging_and_courier.sql",
  "scripts/telegram-notification-worker.mjs",
  "lib/server/telegram-order-messages.ts",
  "app/api/integrations/telegram/webhook/route.ts",
  "app/api/account/orders/[publicId]/messages/route.ts",
  "lib/server/orders/courier-observations.ts",
  "lib/server/orders/courier-sync.ts",
  "config/env.ts"
].map(read))
const [first,second,worker,service,webhook,customer,observations,sync,env] = files
// The existing orders, order_events and payment_events primary keys use TEXT.
// Catch incompatible Telegram FKs before attempting a database migration.
assert(first.includes("order_id text NOT NULL REFERENCES orders(id)"))
assert(first.includes("source_event_id text NOT NULL"))
assert(second.split("order_id text NOT NULL REFERENCES orders(id)").length - 1 === 2)
assert(second.includes("gen_random_uuid()::text"))
assert((await read("db/migrations/102_telegram_courier_watch.sql"))
  .includes("order_id text PRIMARY KEY REFERENCES orders(id)"))

for (const table of ["telegram_notification_outbox", "telegram_order_messages", "order_courier_observations"])
  assert((first + second).includes("CREATE TABLE " + table), "Missing durable " + table)
assert(first.includes("AFTER INSERT ON order_events") && first.includes("AFTER INSERT ON payment_events"))
assert(second.includes("AFTER UPDATE OF payment_status ON orders"),"Must cover all payment state changes")
assert(second.includes("source IN ('order_event','payment_event','payment_status')"),"Payment source must use isolated outbox")
assert(!second.includes("INSERT INTO order_events"),"Notification trigger must not change business event history")
assert(second.includes("OLD.payment_status IS DISTINCT FROM NEW.payment_status"),"Prevent spurious updates")
assert(second.includes("ADD COLUMN snapshot jsonb"),"Keep event-time truth")
assert(second.includes("UNIQUE (order_id, fingerprint)"),"Deduplicate genuine carrier scans")
assert(second.includes("telegram_update_id bigint NOT NULL UNIQUE"),"Deduplicate incoming Telegram updates")
assert(second.includes("telegram_message_id bigint NOT NULL UNIQUE"),"Reply message IDs must be unique")
assert(worker.includes("FOR UPDATE OF q SKIP LOCKED"),"Use transactional safe claim")
assert(worker.includes("ORDER BY q.id"),"Queue oldest-first")
assert(worker.includes("last_error"),"Preserve failed sends")
assert(worker.includes("TELEGRAM_ADMIN_CHAT_ID"),"Send only to authorized owner")
assert(worker.includes("Object.prototype.hasOwnProperty.call(snapshot, key)"),"Do not replace null event-time facts with later data")
assert(service.includes("q.telegram_message_id = $1") && service.includes("q.sent_at IS NOT NULL"),"Never route by typed order ID")
assert(service.includes("ON CONFLICT DO NOTHING"),"Replay and message ID collision protection missing")
assert(service.includes("o.id =") || service.includes("customer_account_id=$2") || service.includes("customer_account_id = $2"),"Customer ownership missing")
assert(service.includes("customer_account_id=$2"),"Customer account must scope all reads")
assert(customer.includes("getCustomerSession"),"Require customer session")
assert(customer.includes("enforceSameOrigin(request)"),"Read acknowledgement must be CSRF protected")
assert(customer.includes("Cache-Control"),"Customer messages must never be publicly cached")
assert(webhook.includes("timingSafeEqual"),"Require timing-safe secret validation")
assert(webhook.includes('ignored: "UNAUTHORIZED_SENDER"'),"Unauthorized legitimate Telegram updates must be acknowledged safely")
assert(webhook.includes("x-telegram-bot-api-secret-token"),"Require Telegram's secret header")
assert(webhook.includes('message.chat?.type !== "private"'),"Reject group/channel injection")
assert(webhook.includes("message.from?.id"),"Check actual admin sender")
assert(!webhook.includes("process.env"),"Keep env reads centralized")
assert(sync.includes("try {\n      await recordCourierObservation("),"Carrier notification failure must be isolated")
assert(observations.includes("ON CONFLICT (order_id,fingerprint) DO NOTHING"),"Reject duplicate scans")
assert(env.includes('telegramWebhookSecret: read("TELEGRAM_WEBHOOK_SECRET")'))

// Execute the actual notification formatter in a sandbox. No real Telegram,
// payment, SQL or customer data is accessed.
const start = worker.indexOf("const money =")
const end = worker.indexOf("async function sendTelegram")
assert(start > 0 && end > start)
const formatter = vm.runInNewContext(worker.slice(start, end) + "\ncomposeMessage")
const base = {
  source:"order_event",source_event_id:"e-1",event_type:"order_created",
  payload:{},occurred_at:"2026-10-13T05:00:00Z", public_id:"CEL-TEST",
  customer_name:"Example",phone:"0000000000",order_type:"individual",
  line_items:[{productId:"p1",name:"Korean Bangles",quantity:2,unitPricePaise:19900,lineTotalPaise:39800}],
  tier_name:"Individual",selected_product_names:[],subtotal_paise:39800,
  discount_paise:0,shipping_paise:0,amount_paise:39800,payment_status:"paid",
  payment_provider:"razorpay",paid_at:"2026-10-13T06:00:00Z",status:"delivered",
  shipping_provider:"Shipway",shipping_tracking_number:"AWB",
  receiver_name:"Example",address:"Test",city:"Sikar",state:"Rajasthan",pincode:"332001",
  gift_message:"",required_date:"2026-10-19",
  event_snapshot:{status:"payment_verification_pending",paymentStatus:"pending",paymentProvider:null,
    paidAt:null,amountPaise:39800,subtotalPaise:39800,discountPaise:0,
    shippingPaise:0,shippingProvider:null,trackingNumber:null}
}
const newOrder = formatter(base)
assert(newOrder.includes("Payment status: pending"),"Queued new order must retain pending state")
assert(newOrder.includes("Paid amount: Not confirmed"),"Never show future payment as received")
assert(newOrder.includes("Paid at: Not recorded"),"Do not use a later payment timestamp")
assert(newOrder.includes("Korean Bangles × 2"),"Preserve actual product quantity")
assert(newOrder.includes("Event ID: e-1"),"Include source trace ID")
const cancelled = formatter({...base,event_type:"status_changed",payload:{
  from:"preparing",to:"cancelled",source:"customer",shipwayCancelled:false
},event_snapshot:{...base.event_snapshot,status:"cancelled",paymentStatus:"paid",paidAt:"2026-10-13T06:00:00Z"}})
assert(cancelled.includes("ORDER CANCELLED") && cancelled.includes("Cancelled by: Customer"))
assert(cancelled.includes("Courier cancellation confirmed: No"))
assert(cancelled.includes("Refund: Review required"),"Do not claim refund completed")
const carrier = formatter({...base,event_type:"courier_observed",payload:{
  code:"PKF",stage:"exception",label:"Pickup failed",scanOccurredAt:"2026-10-13T07:00:00Z"
}})
assert(carrier.includes("Pickup failed"),"Carrier exceptions should reach Telegram")
console.log("TELEGRAM_BACKEND_CHECKS_PASSED: durable events, snapshot truth, isolated courier, Telegram identity, owner scoped messages, replay protection, formatting fixtures.")
