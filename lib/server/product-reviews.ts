import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { isReviewableOrder, ProductReviewError, type PublicProductReview } from "../domain/reviews"
import { deleteReviewPhoto, uploadReviewPhoto } from "./r2"
import { query } from "./db"

type ReviewRow = {
  id: string
  reviewer_name: string
  reviewer_city: string
  rating: number
  review_text: string
  photo_key: string | null
  submitted_at: Date
}

export async function approvedProductReviews(productId: string): Promise<PublicProductReview[]> {
  const result = await query<ReviewRow>(
    `SELECT id::text, reviewer_name, reviewer_city, rating, review_text, photo_key, submitted_at
       FROM product_reviews
      WHERE product_id = $1 AND status = 'approved'
      ORDER BY submitted_at DESC LIMIT 60`, [productId]
  )
  return result.rows.map((r) => ({
    id: r.id, reviewerName: r.reviewer_name, reviewerCity: r.reviewer_city,
    rating: r.rating, text: r.review_text,
    photoUrl: r.photo_key ? `/api/reviews/photo/${r.id}` : null,
    submittedAt: r.submitted_at.toISOString()
  }))
}

type EligibilityRow = { id: string; city: string }
async function eligibleDeliveredOrder(accountId: string, productId: string) {
  const result = await query<EligibilityRow>(
    `SELECT o.id, o.city
       FROM orders o
      WHERE o.customer_account_id = $1
        AND o.order_type = 'individual'
        AND o.status = 'delivered'
        AND o.payment_status IN ('paid','verified')
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(o.line_items) AS item
          WHERE item->>'productId' = $2
        )
      ORDER BY o.delivered_at DESC NULLS LAST, o.created_at DESC LIMIT 1`,
    [accountId, productId]
  )
  return result.rows[0] || null
}

export async function getCustomerReviewEligibility(accountId: string, productId: string) {
  const [purchased, previous] = await Promise.all([
    eligibleDeliveredOrder(accountId, productId),
    query<{ status: string }>(
      `SELECT status FROM product_reviews WHERE customer_account_id=$1 AND product_id=$2`,
      [accountId, productId]
    )
  ])
  return {
    eligible: Boolean(purchased && !previous.rows[0]),
    alreadySubmitted: Boolean(previous.rows[0]),
    reviewStatus: previous.rows[0]?.status || null
  }
}

export async function submitProductReview(input: {
  productId: string; accountId: string; rating: number; text: string; photo: File | null
}) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.productId)) throw new ProductReviewError("INVALID_PRODUCT", 400)
  // Any customer submitted claim is ignored; profile name and shipment city
  // are read exclusively from the verified account and delivered order.
  const account = await query<{ display_name: string }>(
    `SELECT display_name FROM customer_accounts
     WHERE id=$1 AND status='active' AND phone_verified_at IS NOT NULL`, [input.accountId]
  )
  if (!account.rows[0]) throw new ProductReviewError("AUTH_REQUIRED", 401)
  const order = await eligibleDeliveredOrder(input.accountId, input.productId)
  if (!order) throw new ProductReviewError("VERIFIED_DELIVERED_PURCHASE_REQUIRED", 403)
  const previous = await query<{ id: string }>(
    `SELECT id::text FROM product_reviews WHERE customer_account_id=$1 AND product_id=$2`,
    [input.accountId, input.productId]
  )
  if (previous.rows.length) throw new ProductReviewError("REVIEW_ALREADY_SUBMITTED", 409)

  const id = randomUUID()
  let key: string | null = null
  if (input.photo) {
    const photo = input.photo
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 3 * 1024 * 1024 || photo.size < 1) {
      throw new ProductReviewError("INVALID_REVIEW_PHOTO", 422)
    }
    let rendered: Buffer
    try {
      // Image metadata/EXIF is deliberately stripped to protect customers.
      const original = Buffer.from(await photo.arrayBuffer())
      const probe = await sharp(original, { limitInputPixels: 16_000_000 }).metadata()
      if (!["jpeg", "png", "webp"].includes(probe.format || "")) throw new Error("BAD_FORMAT")
      rendered = await sharp(original, { limitInputPixels: 16_000_000 }).rotate()
        .resize({ width: 1080, height: 1080, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 }).toBuffer()
    } catch {
      throw new ProductReviewError("INVALID_REVIEW_PHOTO", 422)
    }
    if (!rendered.length || rendered.length > 3 * 1024 * 1024) throw new ProductReviewError("INVALID_REVIEW_PHOTO", 422)
    key = `reviews/${id}.webp`
    await uploadReviewPhoto(key, rendered)
  }

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO product_reviews (
        id, product_id, customer_account_id, order_id, reviewer_name, reviewer_city,
        rating, review_text, photo_key, status
      )
      SELECT $1::uuid,$2,$3,o.id,a.display_name,left(o.city,90),$4,$5,$6,'pending'
        FROM orders o JOIN customer_accounts a ON a.id=o.customer_account_id
       WHERE o.id=$7 AND a.id=$3
         AND a.status='active' AND a.phone_verified_at IS NOT NULL
         AND o.order_type='individual' AND o.status='delivered'
         AND o.payment_status IN ('paid','verified')
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.line_items) item WHERE item->>'productId'=$2)
       ON CONFLICT (customer_account_id,product_id) DO NOTHING
       RETURNING id::text`,
      [id, input.productId, input.accountId, input.rating, input.text, key, order.id]
    )
    if (!result.rows[0]) throw new ProductReviewError("REVIEW_ALREADY_SUBMITTED_OR_NOT_ELIGIBLE", 409)
    return { id, status: "pending" as const }
  } catch (error) {
    if (key) {
      try { await deleteReviewPhoto(key) } catch (cleanupError) { console.error("review-photo-cleanup", cleanupError) }
    }
    throw error
  }
}

export type AdminReview = PublicProductReview & { productId: string; status: string }

export async function listAdminReviews(): Promise<AdminReview[]> {
  const result = await query<ReviewRow & { product_id: string; status: string }>(
    `SELECT id::text, product_id, reviewer_name, reviewer_city, rating, review_text,
            photo_key, status, submitted_at
       FROM product_reviews ORDER BY
         CASE WHEN status='pending' THEN 0 ELSE 1 END, submitted_at DESC
       LIMIT 100`
  )
  return result.rows.map((r) => ({
    id: r.id, productId: r.product_id, reviewerName: r.reviewer_name,
    reviewerCity: r.reviewer_city, rating: r.rating, text: r.review_text,
    photoUrl: r.photo_key ? `/api/reviews/photo/${r.id}` : null,
    status: r.status, submittedAt: r.submitted_at.toISOString()
  }))
}

export async function moderateReview(id: string, status: "approved" | "rejected") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ProductReviewError("INVALID_REVIEW_ID", 400)
  const result = await query<{ id: string }>(
    `UPDATE product_reviews SET status=$2,reviewed_at=now()
     WHERE id=$1::uuid AND status='pending' RETURNING id::text`, [id, status]
  )
  if (!result.rows[0]) throw new ProductReviewError("REVIEW_ALREADY_REVIEWED", 409)
  return { id, status }
}

export async function approvedOrAdminPhotoKey(id: string, isAdmin: boolean) {
  const result = await query<{ photo_key: string | null }>(
    `SELECT photo_key FROM product_reviews WHERE id=$1::uuid AND (status='approved' OR $2::boolean)`,
    [id, isAdmin]
  )
  return result.rows[0]?.photo_key || null
}
