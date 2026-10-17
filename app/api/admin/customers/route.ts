import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { listAdminCustomers, AdminCustomerQueryError } from "../../../../lib/server/admin-customers"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { validation } from "../../../../config/validation"

export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noStore })
  try {
    if (!await consumeRequestRateLimit("admin-customers-directory", request, validation.rateLimits.adminMutation)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
    }
    const url = new URL(request.url)
    const list = await listAdminCustomers({
      search: url.searchParams.get("search") || "",
      status: url.searchParams.get("status") || "all",
      page: url.searchParams.get("page") || "1"
    })
    return NextResponse.json({ ok: true, ...list }, { headers: noStore })
  } catch (error) {
    if (error instanceof AdminCustomerQueryError) return NextResponse.json(
      { ok: false, error: error.code }, { status: error.status, headers: noStore })
    console.error("admin-customer-directory", error)
    return NextResponse.json({ ok: false, error: "CUSTOMER_DIRECTORY_UNAVAILABLE" },
      { status: 503, headers: noStore })
  }
}
