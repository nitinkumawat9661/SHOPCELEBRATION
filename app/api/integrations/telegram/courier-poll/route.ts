import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { env } from "../../../../../config/env"
import { transaction } from "../../../../../lib/server/db"
import { syncOrderCourier } from "../../../../../lib/server/orders/courier-sync"
import type { CourierEligibleOrder } from "../../../../../lib/server/orders/courier-sync"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }
type Candidate = {
  id: string
  public_id: string
  order_type: "hamper" | "individual"
  status: CourierEligibleOrder["status"]
  payment_status: string
  shipping_provider: string | null
  shipping_tracking_number: string | null
  created_at: Date
}
function correctSecret(value: string | null) {
  if (!env.telegramCourierPollSecret || env.telegramCourierPollSecret.length < 32 || !value) return false
  return timingSafeEqual(
    createHash("sha256").update(value).digest(),
    createHash("sha256").update(env.telegramCourierPollSecret).digest()
  )
}

// This route is disabled until the private secret is configured and cron is
// explicitly enabled by the owner on VPS. Max 3 shipments per run; no UI calls it.
export async function POST(request: Request) {
  if (!env.telegramCourierPollSecret)
    return NextResponse.json({ ok: false, error: "POLLING_DISABLED" }, { status: 503, headers })
  if (!correctSecret(request.headers.get("x-celebration-telegram-cron-secret")))
    return NextResponse.json({ ok: false }, { status: 403, headers })

  try {
    const orders = await transaction(async client => {
      const result = await client.query<Candidate>(
        `SELECT o.id,o.public_id,o.order_type,o.status,o.payment_status,
                o.shipping_provider,o.shipping_tracking_number,o.created_at
           FROM orders o
           LEFT JOIN telegram_courier_poll_state p ON p.order_id=o.id
          WHERE lower(o.shipping_provider)='shipway'
            AND o.shipping_tracking_number IS NOT NULL
            AND o.payment_status IN ('paid','verified')
            AND o.status IN ('preparing','customer_approved','shipped','out_for_delivery')
            AND (p.last_checked_at IS NULL OR p.last_checked_at < now() - interval '5 minutes')
          ORDER BY p.last_checked_at ASC NULLS FIRST, o.created_at ASC
          LIMIT 3 FOR UPDATE OF o SKIP LOCKED`
      )
      for (const order of result.rows) {
        await client.query(
          `INSERT INTO telegram_courier_poll_state(order_id,last_checked_at)
           VALUES($1,now())
           ON CONFLICT (order_id) DO UPDATE SET last_checked_at=now()`,
          [order.id]
        )
      }
      return result.rows
    })
    const settled = await Promise.allSettled(orders.map(order =>
      syncOrderCourier({
        publicId: order.public_id,
        orderType: order.order_type,
        status: order.status,
        paymentStatus: order.payment_status,
        shippingProvider: order.shipping_provider,
        shippingTrackingNumber: order.shipping_tracking_number,
        createdAt: order.created_at.toISOString()
      }, { recoverUnlinkedShipment: false })
    ))
    const failures = settled.filter(item => item.status === "rejected").length
    if (failures) console.error("telegram-courier-poll-failures", { failures })
    return NextResponse.json({ ok: true, checked: orders.length, failures }, { headers })
  } catch (error) {
    console.error("telegram-courier-poll", error instanceof Error ? error.message : "ERROR")
    return NextResponse.json({ ok: false, error: "COURIER_POLL_UNAVAILABLE" }, { status: 503, headers })
  }
}
