import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { listAdminReviews, moderateReview } from "../../../../lib/server/product-reviews"
import { ProductReviewError } from "../../../../lib/domain/reviews"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, reviews: await listAdminReviews() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-reviews", error)
    return NextResponse.json({ ok: false, error: "REVIEWS_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    if (!await consumeRequestRateLimit("admin-review-moderate", request, { windowSeconds: 60, max: 30 })) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    }
    const body = await readJsonBody<{ id?: unknown; status?: unknown }>(request)
    if (typeof body.id !== "string" || (body.status !== "approved" && body.status !== "rejected")) {
      throw new ProductReviewError("INVALID_REVIEW_ACTION")
    }
    return NextResponse.json({ ok: true, ...(await moderateReview(body.id, body.status)) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof RequestSecurityError || error instanceof ProductReviewError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    }
    console.error("admin-review-moderate", error)
    return NextResponse.json({ ok: false, error: "REVIEW_MODERATION_FAILED" }, { status: 503 })
  }
}
