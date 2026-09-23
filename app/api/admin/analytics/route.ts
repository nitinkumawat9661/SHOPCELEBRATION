import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { getConversionAnalytics } from "../../../../lib/server/conversion-analytics"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    const url = new URL(request.url)
    const days = Number(url.searchParams.get("days") || 30)
    return NextResponse.json({ ok: true, analytics: await getConversionAnalytics(days) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-analytics", error)
    return NextResponse.json({ ok: false, error: "ANALYTICS_UNAVAILABLE" }, { status: 503 })
  }
}
