"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { CatalogConfig } from "../../../lib/domain/catalog"

type Status = "all" | "pending" | "approved" | "rejected"
type ModerationAction = "approved" | "rejected"
type Review = {
  id: string
  productId: string
  reviewerName: string
  reviewerCity: string
  rating: number
  text: string
  status: Exclude<Status, "all">
  submittedAt: string | null
  reviewedAt: string | null
  photoUrl: string | null
  orderPublicId: string | null
  orderStatus: string | null
  paymentStatus: string | null
  approvalEligibleNow: boolean
}
type Summary = {
  total: number
  pending: number
  approved: number
  rejected: number
  approved_average: string | null
}
type ResponseData = {
  ok?: boolean
  page?: number
  pageSize?: number
  matchingCount?: number
  summary?: Summary
  reviews?: Review[]
  error?: string
}
const filters: { id: Status; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" }
]

function time(value: string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(date)
}
function Stars({ rating }: { rating: number }) {
  const safe = Math.min(5, Math.max(0, Math.round(rating)))
  return <span className="cav3-review-stars" aria-label={rating + " out of 5 stars"}>
    {"★".repeat(safe)}{"☆".repeat(5 - safe)}
  </span>
}
function Pill({ status }: { status: Review["status"] }) {
  return <span className={"cav3-review-pill is-" + status}>{status}</span>
}

/**
 * Existing review moderation remains the authority:
 * - Pending->approved/rejected only via protected /api/admin/reviews PATCH.
 * - Server rechecks paid, delivered, individual-order SKU eligibility.
 * - No owner-authored testimonials, fake ratings, edit/reopen flows or PII.
 */
export function AdminReviewsV3({ catalog, onOpenOrder }: {
  catalog: CatalogConfig | null
  onOpenOrder: (publicId: string) => void
}) {
  const [status, setStatus] = useState<Status>("pending")
  const [rating, setRating] = useState("0")
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [items, setItems] = useState<Review[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [matchingCount, setMatchingCount] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState(25)
  const [busy, setBusy] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(query.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const abort = new AbortController()
    setBusy(true)
    setError("")
    const params = new URLSearchParams({ status, rating, search: debounced, page: String(page) })
    void (async () => {
      try {
        const res = await fetch("/api/admin/reviews/v3?" + params, {
          credentials: "same-origin", cache: "no-store", signal: abort.signal
        })
        const body = await res.json() as ResponseData
        if (!res.ok || !body.ok || !Array.isArray(body.reviews) ||
          !body.summary || !Number.isInteger(body.matchingCount) || !Number.isInteger(body.pageSize)) {
          throw new Error(body.error || "REVIEW_QUEUE_UNAVAILABLE")
        }
        if (abort.signal.aborted) return
        setItems(body.reviews)
        setSummary(body.summary)
        setMatchingCount(body.matchingCount!)
        setPageSize(body.pageSize!)
        // Selected review is only shown when it is present in the current page.
        setSelectedId(id => id && body.reviews?.some(item => item.id === id) ? id : null)
      } catch (cause) {
        if (abort.signal.aborted) return
        setItems([])
        setSummary(null)
        setMatchingCount(null)
        setSelectedId(null)
        setError(cause instanceof Error ? cause.message : "Unable to load review queue")
      } finally {
        if (!abort.signal.aborted) setBusy(false)
      }
    })()
    return () => abort.abort()
  }, [status, rating, debounced, page, revision])

  const selected = items.find(item => item.id === selectedId) || null
  const productNames = useMemo(() => new Map(
    (catalog?.products || []).map(product => [product.id, product.name])), [catalog])
  const pages = matchingCount === null ? 0 : Math.ceil(matchingCount / pageSize)
  const isActionBusy = actionId !== null

  const changeStatus = (next: Status) => {
    if (isActionBusy || next === status) return
    setStatus(next)
    setPage(1)
    setSelectedId(null)
    setNotice("")
  }

  const update = useCallback(async (review: Review, action: ModerationAction) => {
    if (isActionBusy || busy || review.status !== "pending") return
    if (action === "approved" && !review.approvalEligibleNow) {
      setError("Approval blocked: a current, verified paid and delivered order with this exact SKU was not confirmed. Refresh and check the order.")
      return
    }
    const description = action === "approved"
      ? "Publish this customer's original text, stars and attached photo if the existing backend still verifies this delivered paid order? No wording or rating will be changed."
      : "Reject this customer's genuine submitted review? Reject only for a legitimate policy reason (spam, personal data, abusive content or irrelevant material), NOT merely for a low star rating or negative feedback. The existing system does not record a rejection reason or offer restore."
    if (!window.confirm(description)) return
    setActionId(review.id)
    setNotice("")
    setError("")
    try {
      const result = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: review.id, status: action })
      })
      const outcome = await result.json() as { ok?: boolean; error?: string }
      if (!result.ok || !outcome.ok) {
        if (result.status === 409) throw new Error("Review was already moderated or is no longer eligible. Refresh the queue.")
        if (result.status === 401) throw new Error("Admin session expired. Sign in again before moderating.")
        throw new Error(outcome.error || "REVIEW_MODERATION_FAILED")
      }
      setSelectedId(null)
      setNotice(action === "approved"
        ? "Review approved. Only real verified reviews can appear publicly."
        : "Review rejected. Customer text and rating remain unchanged in the stored record.")
      setRevision(value => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review update failed")
      setRevision(value => value + 1)
    } finally { setActionId(null) }
  }, [isActionBusy, busy])

  return <div className="cav3-reviews" aria-label="Real customer review moderation">
    <div className="cav3-review-policy" role="note">
      <b>Authenticity first.</b> Only a signed-in customer with a recorded paid, delivered individual order
      containing the reviewed SKU can submit feedback. The backend rechecks eligibility before approval.
      Do not suppress genuine negative ratings. Original customer text, rating and photo are never edited here.
    </div>

    <div className="cav3-review-metrics">
      <div><span>Submitted reviews</span><b>{summary ? summary.total : "—"}</b><small>Entire database</small></div>
      <div><span>Pending moderation</span><b>{summary ? summary.pending : "—"}</b><small>Awaiting a decision</small></div>
      <div><span>Approved</span><b>{summary ? summary.approved : "—"}</b><small>Approved rows; public display requires continuing eligibility</small></div>
      <div><span>Approved-row average</span><b>{summary?.approved_average || "—"}</b><small>1–5 stars · not an invented public rating</small></div>
    </div>

    <section className="cav3-panel cav3-review-workspace">
      <div className="cav3-panel-head"><h2>Review inbox</h2>
        <button className="cav3-review-reload" type="button" onClick={() => setRevision(value => value + 1)}
          disabled={busy || isActionBusy}>Refresh</button></div>
      <div className="cav3-review-controls">
        <div className="cav3-chips" aria-label="Review approval statuses">
          {filters.map(item => <button type="button" key={item.id}
            className={status === item.id ? "is-active" : ""} disabled={isActionBusy}
            aria-pressed={status === item.id} onClick={() => changeStatus(item.id)}>
            {item.label}{summary ? " (" + (item.id === "all" ? summary.total : summary[item.id]) + ")" : ""}
          </button>)}
        </div>
        <div className="cav3-review-search">
          <input type="search" maxLength={80} value={query}
            placeholder="Search reviewer, product SKU, city or review text…"
            onChange={event => { setQuery(event.target.value); setPage(1); setSelectedId(null) }}
            aria-label="Search review queue" />
          <select value={rating} aria-label="Filter review rating" onChange={event => {
            setRating(event.target.value)
            setPage(1)
            setSelectedId(null)
          }}>
            <option value="0">All ratings</option>
            {[5, 4, 3, 2, 1].map(stars => <option key={stars} value={stars}>{stars} stars</option>)}
          </select>
        </div>
        <small className="cav3-quiet">Showing {busy ? "…" : items.length} of {matchingCount === null ? "—" : matchingCount} matching reviews · oldest pending first</small>
      </div>
      {error && <p className="cav3-error" role="alert">{error}</p>}
      {notice && <p className="cav3-success" role="status">{notice}</p>}
      {busy && <p className="cav3-state" role="status">Loading genuine customer feedback…</p>}
      <div className="cav3-review-content">
        <div className="cav3-review-list">
          {!busy && !error && items.length === 0 && <p className="cav3-state">No submitted reviews match these filters.</p>}
          {!busy && items.map(review =>
            <button type="button" className={"cav3-review-row" + (selected?.id === review.id ? " is-selected" : "")}
              key={review.id} onClick={() => setSelectedId(review.id)}>
              <span className="cav3-review-topline">
                <b>{review.reviewerName}</b><Pill status={review.status} />
              </span>
              <small>{productNames.get(review.productId) || review.productId} · {time(review.submittedAt)}</small>
              <Stars rating={review.rating} />
              <span className="cav3-review-excerpt">{review.text}</span>
            </button>)}
        </div>
        <div className="cav3-review-detail">
          {selected && !busy ? <article>
            <div className="cav3-review-detail-head"><span className="cav3-eyebrow">Original customer feedback</span>
              <Pill status={selected.status} /></div>
            <h3>{selected.reviewerName}</h3>
            <p className="cav3-review-muted">{selected.reviewerCity || "City not recorded"} · Submitted {time(selected.submittedAt)}</p>
            <Stars rating={selected.rating} />
            <p className="cav3-review-body">{selected.text}</p>
            {selected.photoUrl && <figure className="cav3-review-photo">
              <img src={selected.photoUrl} loading="lazy" width={280} height={280}
                referrerPolicy="no-referrer" alt="Original customer-uploaded product review photo" />
              <figcaption>Customer-submitted photo · loaded by existing authorized photo route</figcaption>
            </figure>}
            <section className="cav3-review-proof">
              <h4>Verified purchase check</h4>
              <dl><div><dt>Product ID</dt><dd>{selected.productId}</dd></div>
                <div><dt>Current product name</dt><dd>{productNames.get(selected.productId) || "Not in current live catalog"}</dd></div>
                <div><dt>Linked order</dt><dd>{selected.orderPublicId || "Unavailable"}</dd></div>
                <div><dt>Current order status</dt><dd>{selected.orderStatus || "Unavailable"}</dd></div>
                <div><dt>Current payment status</dt><dd>{selected.paymentStatus || "Unavailable"}</dd></div>
                <div><dt>Eligible to approve now</dt><dd className={selected.approvalEligibleNow ? "cav3-review-yes" : "cav3-review-no"}>
                  {selected.approvalEligibleNow ? "Verified by current order/account conditions" : "Not currently verified"}</dd></div>
                <div><dt>Reviewed at</dt><dd>{time(selected.reviewedAt)}</dd></div>
              </dl>
              {selected.orderPublicId && <button type="button"
                onClick={() => onOpenOrder(selected.orderPublicId!)}>Open linked order →</button>}
            </section>
            {selected.status === "pending" ? <div className="cav3-review-decisions">
              <button type="button" className="cav3-review-approve" disabled={isActionBusy || !selected.approvalEligibleNow}
                onClick={() => void update(selected, "approved")}>
                {actionId === selected.id ? "Saving decision…" : "Approve genuine review"}</button>
              <button type="button" className="cav3-review-reject" disabled={isActionBusy}
                onClick={() => void update(selected, "rejected")}>Reject (policy reasons only)</button>
              {!selected.approvalEligibleNow && <p className="cav3-review-muted">
                Approval disabled. Refresh or inspect the existing order/account eligibility before taking action.</p>}
            </div> : <p className="cav3-review-final">Decision recorded. The existing backend does not support editing, restoring or re-moderating this review.</p>}
          </article> : <p className="cav3-state">{busy ? "Loading review details…" : "Select a review to see original content, order verification and available moderation actions."}</p>}
        </div>
      </div>
      <nav className="cav3-review-pager" aria-label="Review inbox pages">
        <button type="button" disabled={busy || isActionBusy || page <= 1}
          onClick={() => { setPage(value => value - 1); setSelectedId(null) }}>← Previous</button>
        <span>Page {page}{pages ? " of " + pages : ""}</span>
        <button type="button" disabled={busy || isActionBusy || matchingCount === null || page >= pages || page >= 400}
          onClick={() => { setPage(value => value + 1); setSelectedId(null) }}>Next →</button>
      </nav>
    </section>
    <p className="cav3-review-limits">
      Status totals cover the full table; rows are paginated. Approved-row averages are not an exact public-product
      rating if eligibility has subsequently changed. The current backend records status and moderation time,
      but no rejection reason or separate immutable decision-audit log.
    </p>
  </div>
}
