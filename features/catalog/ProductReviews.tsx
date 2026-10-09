"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { PublicProductReview } from "../../lib/domain/reviews"

type Eligibility = {
  signedIn?: boolean
  eligible?: boolean
  alreadySubmitted?: boolean
  reviewStatus?: string | null
}

export function ProductReviews({ productId, reviews }: { productId: string; reviews: PublicProductReview[] }) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/reviews/${encodeURIComponent(productId)}`, { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => { if (ok) setEligibility(json as Eligibility) })
      .catch(() => {})
    return () => controller.abort()
  }, [productId])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const data = new FormData()
      data.set("rating", String(rating))
      data.set("text", body)
      data.set("consent", consent ? "yes" : "no")
      if (photo) data.set("photo", photo)
      const response = await fetch(`/api/reviews/${encodeURIComponent(productId)}`, { method: "POST", body: data })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        if (payload.error === "VERIFIED_DELIVERED_PURCHASE_REQUIRED") throw new Error("Reviews are available after a verified delivery of this product.")
        if (payload.error === "REVIEW_ALREADY_SUBMITTED") throw new Error("Your review for this product has already been received.")
        throw new Error("We couldn't submit this review. Please check the fields and try again.")
      }
      setMessage("Thank you. Your review has been received and will appear after moderation.")
      setEligibility({ signedIn: true, eligible: false, alreadySubmitted: true, reviewStatus: "pending" })
      setBody("")
      setPhoto(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.")
    } finally { setBusy(false) }
  }

  const total = reviews.length
  const average = total ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : null
  return <section className="productReviews" id="customer-reviews" aria-labelledby="product-reviews-title">
    <div className="wrap">
      <div className="productReviewsHead"><div>
        <p className="collectionEyebrow">Customer experiences</p>
        <h2 id="product-reviews-title">Reviews from real customers</h2>
        <p>Only feedback from verified delivered orders is published here.</p>
      </div>{total > 0 && <div className="productReviewsSummary"><strong>{average} <span aria-hidden="true">★</span></strong><small>{total} verified {total === 1 ? "review" : "reviews"}</small></div>}</div>
      {total === 0
        ? <div className="productReviewsEmpty"><p>Be the first to review this product</p><span>No customer reviews have been published yet.</span></div>
        : <div className="productReviewsList">{reviews.map((review) => <article className="productReview" key={review.id}>
            <div className="productReviewTop"><strong>{review.reviewerName}</strong><span>{review.reviewerCity}</span><span className="productReviewVerified">Verified purchase</span></div>
            <div className="productReviewRating" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
            <p>{review.text}</p>
            {review.photoUrl && <img src={review.photoUrl} alt={`Customer-submitted photograph for this product`} loading="lazy" width={180} height={180} />}
            <time dateTime={review.submittedAt}>{new Date(review.submittedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</time>
          </article>)}</div>}
      <div className="productReviewWrite">
        <h3>Share your experience</h3>
        {!eligibility && <p>Sign in to check whether your delivered order is eligible for a review.</p>}
        {eligibility?.signedIn === false && <p>Already received your order? <Link href="/account">Sign in to your account</Link> to leave an honest review.</p>}
        {eligibility?.signedIn && eligibility.alreadySubmitted && <p role="status">{eligibility.reviewStatus === "approved" ? "Your review is published. Thank you." : "Your review has already been submitted. Thank you for sharing it."}</p>}
        {eligibility?.signedIn && !eligibility.eligible && !eligibility.alreadySubmitted && <p>You'll be able to review this product once your verified order is delivered.</p>}
        {eligibility?.eligible && <form onSubmit={(event) => void submit(event)}>
          <label>Rating <select value={rating} onChange={(e) => setRating(Number(e.target.value))} required>
            <option value="5">★★★★★ — 5 stars</option><option value="4">★★★★☆ — 4 stars</option>
            <option value="3">★★★☆☆ — 3 stars</option><option value="2">★★☆☆☆ — 2 stars</option>
            <option value="1">★☆☆☆☆ — 1 star</option>
          </select></label>
          <label>Your review <textarea rows={4} minLength={15} maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} required placeholder="What did you like? How was the finish, fit or gifting experience?" /></label>
          <label>Photo (optional) <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] || null)} /><small>Up to 3 MB. We remove image metadata before publishing.</small></label>
          <label className="productReviewConsent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /><span>I agree to publish my verified account name, delivery city, rating, review text and optional photo. No phone number or delivery address is shown.</span></label>
          <button type="submit" disabled={busy || !consent || body.trim().length < 15}>{busy ? "Sending review…" : "Submit review"}</button>
        </form>}
        {message && <p role="status" className="productReviewSuccess">{message}</p>}
        {error && <p role="alert" className="productReviewError">{error}</p>}
      </div>
    </div>
  </section>
}
