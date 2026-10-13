import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { query } from "../../../../lib/server/db"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
export async function GET() {
  try {
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
    const orders = await query<{
      public_id: string; tier_name: string; order_type: string; created_at: Date;
      unread_count: number; last_body: string | null; last_sender: string | null; last_at: Date | null;
    }>(
      `SELECT o.public_id,o.tier_name,o.order_type,o.created_at,
              COALESCE(u.unread_count,0)::int AS unread_count,
              m.body AS last_body,m.sender AS last_sender,m.sent_at AS last_at
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS unread_count FROM telegram_order_messages t
           WHERE t.order_id=o.id AND t.sender='celebration_support' AND t.read_at IS NULL
         ) u ON TRUE
         LEFT JOIN LATERAL (
           SELECT body,sender,sent_at FROM telegram_order_messages t
           WHERE t.order_id=o.id ORDER BY sent_at DESC,id DESC LIMIT 1
         ) m ON TRUE
        WHERE o.customer_account_id=$1
        ORDER BY COALESCE(m.sent_at,o.created_at) DESC
        LIMIT 100`,
      [session.accountId]
    )
    return NextResponse.json({ ok: true, threads: orders.rows.map(row => ({
      orderId: row.public_id, title: row.tier_name,
      orderType: row.order_type, createdAt: row.created_at.toISOString(),
      unreadCount: row.unread_count, lastBody: row.last_body,
      lastSender: row.last_sender, lastAt: row.last_at?.toISOString() ?? null
    })) }, { headers })
  } catch (error) {
    console.error("customer-chat-threads", error instanceof Error ? error.message : "ERROR")
    return NextResponse.json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 503, headers })
  }
}
