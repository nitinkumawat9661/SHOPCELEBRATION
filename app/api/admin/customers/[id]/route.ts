import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { getAdminCustomerDetail, AdminCustomerQueryError } from "../../../../../lib/server/admin-customers"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { validation } from "../../../../../config/validation"

export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store" }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest()) return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noStore })
  try {
    if (!await consumeRequestRateLimit("admin-customer-detail", request, validation.rateLimits.adminMutation)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
    }
    const url = new URL(request.url)
    const reveal = url.searchParams.get("address") === "1"
    const { id } = await context.params
    const result = await getAdminCustomerDetail(id, reveal)
    return NextResponse.json({ ok: true, ...result }, { headers: noStore })
  } catch (error) {
    if (error instanceof AdminCustomerQueryError) return NextResponse.json(
      { ok: false, error: error.code }, { status: error.status, headers: noStore })
    console.error("admin-customer-detail", error)
    return NextResponse.json({ ok: false, error: "CUSTOMER_DETAIL_UNAVAILABLE" },
      { status: 503, headers: noStore })
  }
}
