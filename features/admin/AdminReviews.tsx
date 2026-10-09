"use client"

import { useCallback, useEffect, useState } from "react"
import type { PublicProductReview } from "../../lib/domain/reviews"

type AdminReview = PublicProductReview & { productId: string; status: "pending" | "approved" | "rejected" }

export function AdminReviews() {
  const [items, setItems] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const r = await fetch("/api/admin/reviews", { cache: "no-store" })
      const result = await r.json() as { ok?: boolean; reviews?: AdminReview[] }
      if (!r.ok || !result.ok) throw new Error("Could not load customer reviews.")
      setItems(result.reviews || [])
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load reviews.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function decide(review: AdminReview, status: "approved" | "rejected") {
    if (!window.confirm(`Mark this real customer's review as ${status}? Review text and rating cannot be edited.`)) return
    setBusy(review.id)
    setError("")
    setNotice("")
    try {
      const r = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: review.id, status }) })
      const result = await r.json() as { ok?: boolean }
      if (!r.ok || !result.ok) throw new Error("Could not save this review decision.")
      setNotice(`Review ${status}. Only approved genuine reviews appear on the product page.`)
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to moderate review.") }
    finally { setBusy("") }
  }
  const pending = items.filter((x) => x.status === "pending").length
  return <section className="adminWorkspaceCard adminReviews" aria-label="Customer review moderation">
    <div className="adminWorkspaceHead"><div><div className="kicker">AUTHENTIC CUSTOMER VOICES</div>
      <h2>Customer reviews</h2><p>{pending} pending · Verified delivered orders only. No fake reviews or sample testimonials are published.</p></div>
      <button type="button" className="secondary" onClick={() => void refresh()} disabled={loading}>Refresh reviews</button>
    </div>
    {error && <p role="alert" className="errorBox">{error}</p>}
    {notice && <p role="status" className="successBox">{notice}</p>}
    {loading && <p role="status">Loading customer reviews…</p>}
    {!loading && items.length === 0 && <p>No customer reviews have been submitted. This is normal for a new store.</p>}
    <div className="adminReviewsList">{items.map((review) => <article key={review.id} className="adminReviewItem">
      <div><small>{review.productId} · {review.status.toUpperCase()}</small><h3>{review.reviewerName}{review.reviewerCity ? ` · ${review.reviewerCity}` : ""}</h3>
        <span aria-label={`${review.rating} out of five`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
        <p>{review.text}</p>
        {review.photoUrl && <img src={review.photoUrl} width={120} height={120} alt="Customer submitted review photo for moderation" loading="lazy" />}
      </div>
      {review.status === "pending" && <div className="adminReviewButtons">
        <button type="button" onClick={() => void decide(review, "approved")} disabled={Boolean(busy)}>Approve real review</button>
        <button type="button" className="secondary" onClick={() => void decide(review, "rejected")} disabled={Boolean(busy)}>Reject</button>
      </div>}
    </article>)}</div>
  </section>
}
