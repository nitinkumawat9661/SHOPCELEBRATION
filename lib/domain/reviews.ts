import { hasUnsafeText, sanitizeText } from "../validation/text"

export type PublicProductReview = {
  id: string
  reviewerName: string
  reviewerCity: string
  rating: number
  text: string
  photoUrl: string | null
  submittedAt: string
}

export class ProductReviewError extends Error {
  constructor(public readonly code: string, public readonly status = 422) { super(code) }
}

export function normalizeReviewSubmission(rating: unknown, text: unknown, consent: unknown) {
  if (consent !== "yes" && consent !== true) throw new ProductReviewError("PUBLIC_REVIEW_CONSENT_REQUIRED")
  const stars = Number(rating)
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new ProductReviewError("INVALID_RATING")
  if (hasUnsafeText(text)) throw new ProductReviewError("UNSAFE_REVIEW")
  const body = sanitizeText(text, 1200).trim()
  if (body.length < 15 || body.length > 1200) throw new ProductReviewError("INVALID_REVIEW_TEXT")
  return { rating: stars, text: body }
}

export function isReviewableOrder(status: string, paymentStatus: string, orderType: string) {
  return status === "delivered" && ["paid", "verified"].includes(paymentStatus) && orderType === "individual"
}
