import { query } from "./db"
import type { DeliveryAddress } from "../domain/delivery-address"

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAGE_SIZE = 25
const MAX_PAGE = 100

export class AdminCustomerQueryError extends Error {
  constructor(public readonly code: string, public readonly status = 422) { super(code) }
}

type AccountRow = {
  id: string
  display_name: string
  phone: string
  status: "active" | "disabled"
  phone_verified_at: Date | null
  last_login_at: Date | null
  created_at: Date
  has_default_address: boolean
  total_orders: number
  paid_orders: number
  paid_value_paise: string
  reported_issue_orders: number
  last_order_at: Date | null
  wishlist_count: number
}

type AccountDetailRow = AccountRow & { default_address?: DeliveryAddress | null }
type OrderRow = {
  public_id: string
  order_type: "individual" | "hamper"
  tier_name: string
  amount_paise: number
  status: string
  payment_status: string
  issue_type: string | null
  created_at: Date
}
type WishlistRow = { product_id: string; created_at: Date }
type TotalRow = { total: number }

function iso(date: Date | null) { return date ? date.toISOString() : null }
function asValue(raw: string) {
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) throw new AdminCustomerQueryError("INVALID_ORDER_TOTAL", 503)
  return value
}
function maskPhone(phone: string) {
  const last = phone.slice(-4)
  return "••••••" + last
}

function customerView(row: AccountRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    maskedPhone: maskPhone(row.phone),
    status: row.status,
    phoneVerified: Boolean(row.phone_verified_at),
    hasSavedAddress: row.has_default_address,
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at),
    totalLinkedOrders: row.total_orders,
    paidOrders: row.paid_orders,
    paidOrderValuePaise: asValue(row.paid_value_paise),
    reportedIssueOrders: row.reported_issue_orders,
    lastOrderAt: iso(row.last_order_at),
    wishlistCount: row.wishlist_count
  }
}

// This aggregation counts ONLY orders with a verified customer_account_id FK.
// A matching guest order phone or receiver phone is NOT evidence of ownership.
const accountAggregates = `
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS total_orders,
           count(*) FILTER (
             WHERE o.payment_status IN ('paid', 'verified') AND o.status <> 'cancelled'
           )::int AS paid_orders,
           COALESCE(sum(o.amount_paise) FILTER (
             WHERE o.payment_status IN ('paid', 'verified') AND o.status <> 'cancelled'
           ), 0)::text AS paid_value_paise,
           count(*) FILTER (WHERE o.issue_type IS NOT NULL OR o.status = 'issue_reported')::int AS reported_issue_orders,
           max(o.created_at) AS last_order_at
      FROM orders o WHERE o.customer_account_id = a.id
  ) stats ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS wishlist_count
      FROM customer_wishlist w WHERE w.account_id = a.id
  ) saves ON TRUE`

const aggregateSelect = `a.id, a.display_name, a.phone, a.status,
  a.phone_verified_at, a.last_login_at, a.created_at,
  (a.default_address IS NOT NULL) AS has_default_address,
  stats.total_orders, stats.paid_orders, stats.paid_value_paise,
  stats.reported_issue_orders, stats.last_order_at, saves.wishlist_count`

function validateSearch(input: unknown) {
  if (typeof input !== "string") return ""
  const search = input.trim()
  if (search.length > 80 || /[\u0000-\u001f\u007f]/.test(search)) throw new AdminCustomerQueryError("INVALID_CUSTOMER_SEARCH")
  return search
}
function validatePage(input: unknown) {
  const n = input === undefined || input === null ? 1 : Number(input)
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_PAGE) throw new AdminCustomerQueryError("INVALID_CUSTOMER_PAGE")
  return n
}

export async function listAdminCustomers(input: { search?: unknown; status?: unknown; page?: unknown }) {
  const search = validateSearch(input.search)
  const page = validatePage(input.page)
  const status = input.status ?? "all"
  if (status !== "all" && status !== "active" && status !== "disabled") {
    throw new AdminCustomerQueryError("INVALID_CUSTOMER_FILTER")
  }
  const exactPhone = /^\d{10}$/.test(search) ? search : null
  const values = [search, exactPhone, status, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  const filter = `($1::text = '' OR strpos(lower(a.display_name), lower($1)) > 0
      OR ($2::text IS NOT NULL AND a.phone = $2::text))
    AND ($3::text = 'all' OR a.status = $3::text)`
  const [count, result] = await Promise.all([
    query<TotalRow>(`SELECT count(*)::int AS total FROM customer_accounts a WHERE ${filter}`,
      values.slice(0, 3)),
    query<AccountRow>(`
      WITH page AS (
        SELECT a.id FROM customer_accounts a
         WHERE ${filter}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT $4 OFFSET $5
      )
      SELECT ${aggregateSelect}
        FROM page p
        JOIN customer_accounts a ON a.id = p.id
        ${accountAggregates}
       ORDER BY a.created_at DESC, a.id DESC`, values)
  ])
  return {
    customers: result.rows.map(customerView),
    page,
    pageSize: PAGE_SIZE,
    total: count.rows[0]?.total || 0
  }
}

export async function getAdminCustomerDetail(id: unknown, includeAddress = false) {
  if (typeof id !== "string" || !ACCOUNT_ID.test(id)) {
    throw new AdminCustomerQueryError("INVALID_CUSTOMER_ID")
  }
  const result = await query<AccountDetailRow>(`
    SELECT ${aggregateSelect}${includeAddress ? ", a.default_address" : ""}
      FROM customer_accounts a
      ${accountAggregates}
     WHERE a.id = $1 LIMIT 1`, [id])
  const account = result.rows[0]
  if (!account) throw new AdminCustomerQueryError("CUSTOMER_NOT_FOUND", 404)

  const [orders, wishlist] = await Promise.all([
    query<OrderRow>(`
      SELECT public_id, order_type, tier_name, amount_paise, status,
             payment_status, issue_type, created_at
        FROM orders
       WHERE customer_account_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 50`, [id]),
    query<WishlistRow>(`
      SELECT product_id, created_at FROM customer_wishlist
       WHERE account_id = $1
       ORDER BY created_at DESC, product_id DESC
       LIMIT 120`, [id])
  ])
  return {
    customer: customerView(account),
    // Default address is not fetched or serialized until the admin explicitly
    // requests reveal on this single verified account detail.
    ...(includeAddress ? { savedAddress: account.default_address || null } : {}),
    orders: orders.rows.map(row => ({
      publicId: row.public_id,
      orderType: row.order_type,
      tierName: row.tier_name,
      amountPaise: row.amount_paise,
      status: row.status,
      paymentStatus: row.payment_status,
      hasReportedIssue: Boolean(row.issue_type || row.status === "issue_reported"),
      createdAt: iso(row.created_at)
    })),
    savedProducts: wishlist.rows.map(row => ({
      productId: row.product_id,
      savedAt: iso(row.created_at)
    }))
  }
}
