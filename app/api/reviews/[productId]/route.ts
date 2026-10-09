import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { getCustomerReviewEligibility, submitProductReview } from "../../../../lib/server/product-reviews"
import { normalizeReviewSubmission, ProductReviewError } from "../../../../lib/domain/reviews"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MAX_REQUEST_BYTES = 3_600_000
const validId = (id: string) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(id)

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const id = (await context.params).productId
    if (!validId(id)) return NextResponse.json({ ok: false, error: "INVALID_PRODUCT" }, { status: 400 })
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: true, signedIn: false, eligible: false, alreadySubmitted: false }, { headers: { "Cache-Control": "no-store" } })
    const result = await getCustomerReviewEligibility(session.accountId, id)
    return NextResponse.json({ ok: true, signedIn: true, ...result }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("review-eligibility", error)
    return NextResponse.json({ ok: false, error: "REVIEW_UNAVAILABLE" }, { status: 503 })
  }
}

async function boundedFormData(request: Request) {
  const type = request.headers.get("content-type") || ""
  if (!type.toLowerCase().startsWith("multipart/form-data;")) throw new ProductReviewError("INVALID_FORM", 415)
  const length = Number(request.headers.get("content-length") || 0)
  if (length > MAX_REQUEST_BYTES) throw new ProductReviewError("REVIEW_TOO_LARGE", 413)
  if (!request.body) throw new ProductReviewError("INVALID_FORM", 400)
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = request.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new ProductReviewError("REVIEW_TOO_LARGE", 413)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
  const inner = new Request(request.url, {
    method: "POST",
    headers: { "content-type": type },
    body
  })
  return inner.formData()
}

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await getCustomerSession()
    if (!session) throw new ProductReviewError("AUTH_REQUIRED", 401)
    enforceSameOrigin(request)
    const id = (await context.params).productId
    if (!validId(id)) throw new ProductReviewError("INVALID_PRODUCT", 400)
    const permitted = await consumeRequestRateLimit(`review-submit:${session.accountId}`, request, { windowSeconds: 3600, max: 5 })
    if (!permitted) throw new ProductReviewError("RATE_LIMITED", 429)
    const form = await boundedFormData(request)
    const { rating, text } = normalizeReviewSubmission(form.get("rating"), form.get("text"), form.get("consent"))
    const file = form.get("photo")
    if (file !== null && !(file instanceof File)) throw new ProductReviewError("INVALID_REVIEW_PHOTO", 422)
    const result = await submitProductReview({ productId: id, accountId: session.accountId, rating, text, photo: file })
    return NextResponse.json({ ok: true, ...result }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof ProductReviewError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("review-submit", error)
    return NextResponse.json({ ok: false, error: "REVIEW_SUBMISSION_FAILED" }, { status: 503 })
  }
}
