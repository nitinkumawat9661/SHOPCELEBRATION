import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { listOrders } from "../../../../lib/server/orders"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, orders: await listOrders() })
  } catch (error) {
    console.error("admin-orders", error)
    return NextResponse.json({ ok: false, error: "ORDER_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
