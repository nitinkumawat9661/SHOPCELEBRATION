import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { validation } from "../../../../../config/validation"
import { AdminReviewQueueError, listAdminReviewQueue } from "../../../../../lib/server/admin-review-queue"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers })
  }
  try {
    if (!await consumeRequestRateLimit("admin-v3-review-queue", request, validation.rateLimits.adminMutation)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers })
    }
    const url = new URL(request.url)
    const queue = await listAdminReviewQueue({
      status: url.searchParams.get("status") || "all",
      rating: url.searchParams.get("rating") || "0",
      search: url.searchParams.get("search") || "",
      page: url.searchParams.get("page") || "1"
    })
    return NextResponse.json({ ok: true, ...queue }, { headers })
  } catch (error) {
    if (error instanceof AdminReviewQueueError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers })
    }
    console.error("admin-v3-review-queue", error)
    return NextResponse.json({ ok: false, error: "REVIEW_QUEUE_UNAVAILABLE" }, { status: 503, headers })
  }
}
