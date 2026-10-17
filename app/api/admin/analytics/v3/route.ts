import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { getAdminBehaviourAnalytics, parseBehaviourPeriod } from "../../../../../lib/server/admin-behaviour-analytics"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { validation } from "../../../../../config/validation"

export const dynamic = "force-dynamic"
const privateHeaders = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders })
  try {
    const allowed = await consumeRequestRateLimit(
      "admin-v3-analytics-read", request, validation.rateLimits.adminMutation
    )
    if (!allowed) return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" }, { status: 429, headers: privateHeaders })
    const days = parseBehaviourPeriod(new URL(request.url).searchParams.get("days") || "30")
    const analytics = await getAdminBehaviourAnalytics(days)
    return NextResponse.json({ ok: true, analytics }, { headers: privateHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ANALYTICS_PERIOD") {
      return NextResponse.json(
        { ok: false, error: "INVALID_ANALYTICS_PERIOD" }, { status: 422, headers: privateHeaders })
    }
    console.error("admin-v3-behaviour-analytics", error)
    return NextResponse.json(
      { ok: false, error: "ANALYTICS_UNAVAILABLE" }, { status: 503, headers: privateHeaders })
  }
}
