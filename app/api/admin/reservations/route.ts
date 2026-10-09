import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { getInventoryReservationReview } from "../../../../lib/server/inventory"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  try {
    const report = await getInventoryReservationReview()
    return NextResponse.json({ ok: true, ...report }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-reservation-review", error)
    return NextResponse.json({ ok: false, error: "RESERVATION_REVIEW_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
