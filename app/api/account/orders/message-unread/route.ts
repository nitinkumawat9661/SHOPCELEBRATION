import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../../lib/security/customer-session"
import { query } from "../../../../../lib/server/db"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

// Returns counts only, scoped by the signed-in account. No message bodies or
// foreign order IDs are exposed. One bounded query for the account dashboard.
export async function GET() {
  try {
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
    const result = await query<{ public_id: string; unread_count: number }>(
      `SELECT o.public_id, COUNT(m.id)::int AS unread_count
         FROM telegram_order_messages m
         JOIN orders o ON o.id = m.order_id
        WHERE o.customer_account_id = $1 AND m.read_at IS NULL
        GROUP BY o.public_id
        ORDER BY o.public_id
        LIMIT 200`,
      [session.accountId]
    )
    return NextResponse.json({
      ok: true, unread: result.rows.map(row => ({
        publicId: row.public_id, unreadCount: row.unread_count
      }))
    }, { headers })
  } catch (error) {
    console.error("telegram-unread-counts", error)
    return NextResponse.json({ ok: false, error: "MESSAGES_UNAVAILABLE" }, { status: 503, headers })
  }
}
