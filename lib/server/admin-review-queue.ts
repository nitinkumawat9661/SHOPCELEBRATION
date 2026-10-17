import { query } from "./db"

export type ReviewQueueFilter = "all" | "pending" | "approved" | "rejected"
export type ReviewQueueRating = 0 | 1 | 2 | 3 | 4 | 5

export class AdminReviewQueueError extends Error {
  constructor(public readonly code: string, public readonly status = 422) { super(code) }
}

type QueueRow = {
  id: string
  product_id: string
  reviewer_name: string
  reviewer_city: string
  rating: number
  review_text: string
  photo_key: string | null
  status: "pending" | "approved" | "rejected"
  submitted_at: Date
  reviewed_at: Date | null
  order_public_id: string | null
  order_status: string | null
  payment_status: string | null
  approval_eligible_now: boolean
}
type SummaryRow = { total: number; pending: number; approved: number; rejected: number; approved_average: string | null }
type CountRow = { count: number }

function iso(value: Date | null) { return value ? value.toISOString() : null }

const pageSize = 25
const pageMax = 400
const searchMax = 80

export function parseReviewQueueFilters(input: {
  page?: unknown; status?: unknown; rating?: unknown; search?: unknown
}) {
  const rawPage = input.page ?? "1"
  const page = Number(rawPage)
  if (!Number.isSafeInteger(page) || page < 1 || page > pageMax) throw new AdminReviewQueueError("INVALID_REVIEW_PAGE")
  const status = input.status ?? "all"
  if (status !== "all" && status !== "pending" && status !== "approved" && status !== "rejected") {
    throw new AdminReviewQueueError("INVALID_REVIEW_STATUS")
  }
  const rating = input.rating ?? "0"
  const stars = Number(rating)
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
    throw new AdminReviewQueueError("INVALID_REVIEW_RATING")
  }
  const search = typeof input.search === "string" ? input.search.trim() : ""
  if (search.length > searchMax || /[\u0000-\u001f\u007f]/.test(search)) {
    throw new AdminReviewQueueError("INVALID_REVIEW_SEARCH")
  }
  return { page, status: status as ReviewQueueFilter, rating: stars as ReviewQueueRating, search }
}

/**
 * Admin-only moderation queue, with full status totals and paginated results.
 * The product's current eligible order state is determined using exactly the
 * same signed-in account / paid-delivered / SKU conditions as moderateReview().
 * No customer phone, email, delivery address or full order payload is selected.
 */
export async function listAdminReviewQueue(input: { page?: unknown; status?: unknown; rating?: unknown; search?: unknown }) {
  const { page, status, rating, search } = parseReviewQueueFilters(input)
  const where = `
    ($1::text = 'all' OR r.status = $1)
    AND ($2::integer = 0 OR r.rating = $2)
    AND ($3::text = '' OR strpos(lower(r.product_id), lower($3)) > 0
      OR strpos(lower(r.reviewer_name), lower($3)) > 0
      OR strpos(lower(r.reviewer_city), lower($3)) > 0
      OR strpos(lower(r.review_text), lower($3)) > 0)`
  const [summary, count, result] = await Promise.all([
    query<SummaryRow>(`SELECT
       count(*)::integer AS total,
       count(*) FILTER (WHERE status = 'pending')::integer AS pending,
       count(*) FILTER (WHERE status = 'approved')::integer AS approved,
       count(*) FILTER (WHERE status = 'rejected')::integer AS rejected,
       round(avg(rating) FILTER (WHERE status = 'approved')::numeric, 1)::text AS approved_average
      FROM product_reviews`),
    query<CountRow>(`SELECT count(*)::integer AS count FROM product_reviews r WHERE ${where}`,
      [status, rating, search]),
    query<QueueRow>(`SELECT
       r.id::text AS id, r.product_id, r.reviewer_name, r.reviewer_city, r.rating,
       r.review_text, r.photo_key, r.status, r.submitted_at, r.reviewed_at,
       o.public_id AS order_public_id, o.status AS order_status,
       o.payment_status,
       COALESCE(
         a.status = 'active' AND a.phone_verified_at IS NOT NULL
         AND o.order_type = 'individual' AND o.status = 'delivered'
         AND o.payment_status IN ('paid','verified')
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(o.line_items) AS item
           WHERE item->>'productId' = r.product_id
         ), false
       ) AS approval_eligible_now
       FROM product_reviews r
       LEFT JOIN orders o ON o.id = r.order_id AND o.customer_account_id = r.customer_account_id
       LEFT JOIN customer_accounts a ON a.id = r.customer_account_id
       WHERE ${where}
       ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
                CASE WHEN r.status = 'pending' THEN r.submitted_at END ASC,
                r.submitted_at DESC, r.id DESC
       LIMIT $4 OFFSET $5`, [status, rating, search, pageSize, (page - 1) * pageSize])
  ])

  return {
    page, pageSize, matchingCount: count.rows[0]?.count ?? 0,
    // The global summary covers ALL reviews, not just the current page.
    summary: summary.rows[0] || { total: 0, pending: 0, approved: 0, rejected: 0, approved_average: null },
    reviews: result.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      reviewerName: row.reviewer_name,
      reviewerCity: row.reviewer_city,
      rating: row.rating,
      text: row.review_text,
      status: row.status,
      submittedAt: iso(row.submitted_at),
      reviewedAt: iso(row.reviewed_at),
      photoUrl: row.photo_key ? `/api/reviews/photo/${row.id}` : null,
      orderPublicId: row.order_public_id,
      orderStatus: row.order_status,
      paymentStatus: row.payment_status,
      approvalEligibleNow: row.approval_eligible_now
    }))
  }
}
