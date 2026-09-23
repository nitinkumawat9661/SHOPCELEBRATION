import { createHash, randomUUID } from "node:crypto"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"
import { isUuidV4 } from "../validation/identifiers"
import { sanitizeText } from "../validation/text"
import { query } from "./db"

export const conversionEventNames = [
  "storefront_view",
  "budget_selected",
  "builder_started",
  "checkout_reached",
  "offer_shown",
  "payment_started"
] as const

export type ConversionEventName = typeof conversionEventNames[number]

type EventCountRow = { event_name: string; sessions: number; events: number }
type OrderStatsRow = { orders: number; revenue_paise: number; subtotal_paise: number; discount_paise: number }
type RequestStatsRow = { requests: number }
type QuoteStatsRow = { quotes: number; redeemed: number }
type CampaignRow = { campaign_id: string; campaign_title: string; orders: number; revenue_paise: number; discount_paise: number }

function sessionHash(sessionId: string) {
  return createHash(securityConfig.hashAlgorithm).update(`conversion:${sessionId}`).digest("hex")
}

export async function recordConversionEvent(input: {
  sessionId: unknown
  eventName: unknown
  tierId?: unknown
  campaignId?: unknown
  customerAccountId?: string | null
}) {
  const sessionId = String(input.sessionId ?? "").trim()
  if (!isUuidV4(sessionId) || sessionId.length > validation.campaign.sessionIdMax) return false
  const eventName = String(input.eventName ?? "") as ConversionEventName
  if (!conversionEventNames.includes(eventName)) return false
  const tierId = sanitizeText(input.tierId, validation.tierIdMax) || null
  const campaignId = sanitizeText(input.campaignId, validation.campaign.idMax) || null
  await query(
    `INSERT INTO conversion_events (id, session_hash, customer_account_id, event_name, tier_id, campaign_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,now())`,
    [randomUUID(), sessionHash(sessionId), input.customerAccountId || null, eventName, tierId, campaignId]
  )
  return true
}

export async function getConversionAnalytics(days = 30) {
  const safeDays = Math.min(365, Math.max(1, Math.round(days)))
  const [events, orders, requests, quotes, campaigns] = await Promise.all([
    query<EventCountRow>(
      `SELECT event_name, count(DISTINCT session_hash)::int AS sessions, count(*)::int AS events
         FROM conversion_events
        WHERE created_at >= now() - ($1::text || ' days')::interval
        GROUP BY event_name`,
      [safeDays]
    ),
    query<OrderStatsRow>(
      `SELECT count(*)::int AS orders,
              COALESCE(sum(amount_paise),0)::int AS revenue_paise,
              COALESCE(sum(subtotal_paise),0)::int AS subtotal_paise,
              COALESCE(sum(discount_paise),0)::int AS discount_paise
         FROM orders
        WHERE created_at >= now() - ($1::text || ' days')::interval
          AND status <> 'cancelled'`,
      [safeDays]
    ),
    query<RequestStatsRow>(
      `SELECT count(*)::int AS requests FROM custom_hamper_requests
        WHERE created_at >= now() - ($1::text || ' days')::interval`,
      [safeDays]
    ),
    query<QuoteStatsRow>(
      `SELECT count(*)::int AS quotes,
              count(*) FILTER (WHERE redeemed_at IS NOT NULL)::int AS redeemed
         FROM offer_quotes
        WHERE created_at >= now() - ($1::text || ' days')::interval`,
      [safeDays]
    ),
    query<CampaignRow>(
      `SELECT campaign_id,
              COALESCE(max(campaign_title), campaign_id) AS campaign_title,
              count(*)::int AS orders,
              COALESCE(sum(amount_paise),0)::int AS revenue_paise,
              COALESCE(sum(discount_paise),0)::int AS discount_paise
         FROM orders
        WHERE created_at >= now() - ($1::text || ' days')::interval
          AND status <> 'cancelled' AND campaign_id IS NOT NULL
        GROUP BY campaign_id
        ORDER BY orders DESC, revenue_paise DESC`,
      [safeDays]
    )
  ])

  const eventMap = Object.fromEntries(conversionEventNames.map((name) => [name, { sessions: 0, events: 0 }])) as Record<ConversionEventName, { sessions: number; events: number }>
  for (const row of events.rows) {
    if (conversionEventNames.includes(row.event_name as ConversionEventName)) {
      eventMap[row.event_name as ConversionEventName] = { sessions: row.sessions, events: row.events }
    }
  }
  const orderStats = orders.rows[0] || { orders: 0, revenue_paise: 0, subtotal_paise: 0, discount_paise: 0 }
  const quoteStats = quotes.rows[0] || { quotes: 0, redeemed: 0 }
  const viewSessions = eventMap.storefront_view.sessions
  const checkoutSessions = eventMap.checkout_reached.sessions

  return {
    days: safeDays,
    funnel: eventMap,
    orders: orderStats.orders,
    revenuePaise: orderStats.revenue_paise,
    subtotalPaise: orderStats.subtotal_paise,
    discountPaise: orderStats.discount_paise,
    customRequests: requests.rows[0]?.requests || 0,
    offerQuotes: quoteStats.quotes,
    offerRedemptions: quoteStats.redeemed,
    checkoutRate: viewSessions ? Math.round(checkoutSessions * 1000 / viewSessions) / 10 : 0,
    orderRate: viewSessions ? Math.round(orderStats.orders * 1000 / viewSessions) / 10 : 0,
    offerRedemptionRate: quoteStats.quotes ? Math.round(quoteStats.redeemed * 1000 / quoteStats.quotes) / 10 : 0,
    campaigns: campaigns.rows.map((row) => ({
      campaignId: row.campaign_id,
      campaignTitle: row.campaign_title,
      orders: row.orders,
      revenuePaise: row.revenue_paise,
      discountPaise: row.discount_paise
    }))
  }
}
