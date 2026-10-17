import { getConversionAnalytics } from "./conversion-analytics"
import { query } from "./db"

export type BehaviourPeriod = 7 | 30 | 90

type InactivityRow = {
  checkout_sessions_inactive: number
  checkout_without_later_payment_start: number
}
type WishlistTotalRow = {
  saved_relationships: number
  accounts_with_saved: number
  currently_saved_in_period: number
}
type SavedProductRow = { product_id: string; saved_accounts: number }
type ProductSalesRow = {
  product_id: string
  paid_orders: number
  units: string
  gross_line_paise: string
}
type DailyRow = { day: string; paid_orders: number; paid_order_value_paise: string }

function safeMoney(value: string) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("ANALYTICS_AMOUNT_OUT_OF_RANGE")
  return amount
}

export function parseBehaviourPeriod(input: unknown): BehaviourPeriod {
  if (input === 7 || input === "7") return 7
  if (input === 30 || input === "30" || input === undefined || input === null) return 30
  if (input === 90 || input === "90") return 90
  throw new Error("INVALID_ANALYTICS_PERIOD")
}

/**
 * Aggregate-only admin report.
 *
 * Browser carts and checkout drafts currently live in localStorage; they are
 * NOT observable in a server report. This code does not attempt to recover
 * them, join hashed sessions to registered identities, or contact customers.
 *
 * A checkout session with no later recorded payment-start event after its
 * last observed event becomes 60m old is only a TELEMETRY DROP-OFF PROXY.
 * It is NOT proof of actual abandonment or an identifiable checkout record.
 */
export async function getAdminBehaviourAnalytics(days: BehaviourPeriod) {
  const [overview, inactivity, wishlist, savedProducts, paidProducts, paidDays] = await Promise.all([
    getConversionAnalytics(days),
    query<InactivityRow>(
      `WITH scoped_sessions AS (
         SELECT session_hash,
                MIN(created_at) FILTER (WHERE event_name = 'checkout_reached') AS checkout_at,
                MAX(created_at) FILTER (WHERE event_name = 'payment_started') AS latest_payment_start_at,
                MAX(created_at) AS last_event_at
           FROM conversion_events
          WHERE created_at >= now() - ($1::text || ' days')::interval
          GROUP BY session_hash
       )
       SELECT count(*) FILTER (
                WHERE checkout_at IS NOT NULL
                  AND last_event_at <= now() - interval '60 minutes'
              )::int AS checkout_sessions_inactive,
              count(*) FILTER (
                WHERE checkout_at IS NOT NULL
                  AND last_event_at <= now() - interval '60 minutes'
                  AND (latest_payment_start_at IS NULL OR latest_payment_start_at < checkout_at)
              )::int AS checkout_without_later_payment_start
         FROM scoped_sessions`,
      [days]
    ),
    query<WishlistTotalRow>(
      `SELECT count(*)::int AS saved_relationships,
              count(DISTINCT account_id)::int AS accounts_with_saved,
              count(*) FILTER (
                WHERE created_at >= now() - ($1::text || ' days')::interval
              )::int AS currently_saved_in_period
         FROM customer_wishlist`,
      [days]
    ),
    query<SavedProductRow>(
      `SELECT product_id, count(*)::int AS saved_accounts
         FROM customer_wishlist
        GROUP BY product_id
        ORDER BY saved_accounts DESC, product_id ASC
        LIMIT 12`
    ),
    query<ProductSalesRow>(
      `SELECT line.item->>'productId' AS product_id,
              count(DISTINCT o.id)::int AS paid_orders,
              sum((line.item->>'quantity')::bigint)::text AS units,
              sum((line.item->>'lineTotalPaise')::bigint)::text AS gross_line_paise
         FROM orders o
         CROSS JOIN LATERAL jsonb_array_elements(o.line_items) AS line(item)
        WHERE o.created_at >= now() - ($1::text || ' days')::interval
          AND o.order_type = 'individual'
          AND o.status <> 'cancelled'
          AND o.payment_status IN ('paid','verified')
        GROUP BY line.item->>'productId'
        ORDER BY sum((line.item->>'quantity')::bigint) DESC,
                 sum((line.item->>'lineTotalPaise')::bigint) DESC
        LIMIT 500`,
      [days]
    ),
    query<DailyRow>(
      `SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS day,
              count(*)::int AS paid_orders,
              COALESCE(sum(amount_paise),0)::text AS paid_order_value_paise
         FROM orders
        WHERE created_at >= now() - ($1::text || ' days')::interval
          AND status <> 'cancelled'
          AND payment_status IN ('paid','verified')
        GROUP BY (created_at AT TIME ZONE 'Asia/Kolkata')::date
        ORDER BY day ASC`,
      [days]
    )
  ])

  const inactive = inactivity.rows[0]
  const wish = wishlist.rows[0]
  return {
    days,
    overview,
    // Aggregate event-session counts only. No session_hash, account IDs or phone.
    checkoutTelemetry: {
      inactivityMinutes: 60,
      checkoutSessionsInactive: inactive?.checkout_sessions_inactive ?? 0,
      checkoutWithoutLaterPaymentStart: inactive?.checkout_without_later_payment_start ?? 0,
      cartAbandonmentAvailable: false as const,
      identifiableCheckoutRecoveryAvailable: false as const
    },
    wishlist: {
      savedRelationshipsCurrent: wish?.saved_relationships ?? 0,
      accountsWithSavedCurrent: wish?.accounts_with_saved ?? 0,
      currentSavesCreatedInPeriod: wish?.currently_saved_in_period ?? 0,
      topProducts: savedProducts.rows.map(row => ({
        productId: row.product_id,
        savedAccounts: row.saved_accounts
      }))
    },
    individualProductSales: paidProducts.rows.map(row => ({
      productId: row.product_id,
      paidOrders: row.paid_orders,
      units: safeMoney(row.units),
      grossLineValuePaise: safeMoney(row.gross_line_paise)
    })),
    dailyPaidOrders: paidDays.rows.map(row => ({
      day: row.day,
      paidOrders: row.paid_orders,
      paidOrderValuePaise: safeMoney(row.paid_order_value_paise)
    }))
  }
}
