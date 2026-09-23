import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { validation } from "../../config/validation"
import type { CatalogConfig } from "../domain/catalog"
import { tierById } from "../domain/catalog"
import { emptyCampaignConfig, type Campaign, type CampaignConfig, type CampaignTrigger, type OfferQuote } from "../domain/campaign"
import type { NormalizedOrder } from "../domain/order"
import { toMinorUnits } from "../domain/payment"
import { isUuidV4 } from "../validation/identifiers"
import { hasUnsafeText, sanitizeText } from "../validation/text"
import { query, transaction } from "./db"

type ConfigRow = { payload: unknown; version: number }
type CountRow = { count: number }
type QuoteRow = {
  id: string
  campaign_id: string
  campaign_title: string
  customer_account_id: string
  trigger: CampaignTrigger
  tier_id: string
  selected_product_ids: string[]
  subtotal_paise: number
  discount_paise: number
  payable_paise: number
  expires_at: Date
  redeemed_at: Date | null
}

export type OrderPricing = {
  subtotalPaise: number
  discountPaise: number
  payablePaise: number
  campaignId: string | null
  campaignTitle: string | null
  offerQuoteId: string | null
}

export class CampaignError extends Error {
  constructor(public readonly code: string) { super(code) }
}

const slugPattern = /^[a-z0-9][a-z0-9-]*$/

function cleanText(value: unknown, max: number, fallback = "") {
  if (hasUnsafeText(value)) throw new CampaignError("UNSAFE_TEXT")
  return sanitizeText(value, max) || fallback
}

function integer(value: unknown, min: number, max: number, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0 && item.length <= validation.campaign.idMax && slugPattern.test(item))))
}

function isoOrBlank(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) throw new CampaignError("INVALID_CAMPAIGN_DATE")
  return date.toISOString()
}

function normalizeCampaign(input: unknown): Campaign {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const id = cleanText(raw.id, validation.campaign.idMax).toLowerCase()
  if (!id || !slugPattern.test(id)) throw new CampaignError("INVALID_CAMPAIGN_ID")
  const discountType = raw.discountType === "fixed" ? "fixed" : "percent"
  const trigger: CampaignTrigger = raw.trigger === "hesitation" ? "hesitation" : "checkout"
  const audience = raw.audience === "first_order" ? "first_order" : "all"
  const discountValue = discountType === "percent"
    ? integer(raw.discountValue, 1, validation.campaign.maxPercent, 10)
    : integer(raw.discountValue, 1, validation.campaign.maxRupees, 100)
  const startAt = isoOrBlank(raw.startAt)
  const endAt = isoOrBlank(raw.endAt)
  if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) throw new CampaignError("INVALID_CAMPAIGN_DATE")

  return {
    id,
    name: cleanText(raw.name, validation.campaign.nameMax, "Offer"),
    badge: cleanText(raw.badge, validation.campaign.badgeMax, "SPECIAL OFFER"),
    message: cleanText(raw.message, validation.campaign.messageMax, "A better price is available for this hamper."),
    active: raw.active === true,
    trigger,
    audience,
    discountType,
    discountValue,
    maxDiscountRupees: integer(raw.maxDiscountRupees, 0, validation.campaign.maxRupees),
    minSubtotalRupees: integer(raw.minSubtotalRupees, 0, validation.campaign.maxRupees),
    eligibleTierIds: stringList(raw.eligibleTierIds),
    eligibleProductIds: stringList(raw.eligibleProductIds),
    startAt,
    endAt,
    totalLimit: integer(raw.totalLimit, 0, validation.campaign.maxUsageLimit),
    perCustomerLimit: integer(raw.perCustomerLimit, 0, validation.campaign.maxUsageLimit)
  }
}

export function normalizeCampaignConfig(input: unknown): CampaignConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const campaigns = Array.isArray(raw.campaigns) ? raw.campaigns.slice(0, validation.campaign.maxCampaigns).map(normalizeCampaign) : []
  const ids = new Set<string>()
  for (const campaign of campaigns) {
    if (ids.has(campaign.id)) throw new CampaignError("DUPLICATE_CAMPAIGN_ID")
    ids.add(campaign.id)
  }
  return { campaigns }
}

async function ensureConfig(client?: PoolClient) {
  const run = client ? client.query.bind(client) : query
  const existing = await run<ConfigRow>(`SELECT payload, version FROM campaign_config WHERE id = 'primary'`)
  if (existing.rows[0]) return { config: normalizeCampaignConfig(existing.rows[0].payload), version: existing.rows[0].version }
  const seed = normalizeCampaignConfig(emptyCampaignConfig)
  const inserted = await run<ConfigRow>(
    `INSERT INTO campaign_config (id, payload, version, updated_at)
     VALUES ('primary', $1::jsonb, 1, now())
     ON CONFLICT (id) DO NOTHING
     RETURNING payload, version`,
    [JSON.stringify(seed)]
  )
  if (inserted.rows[0]) return { config: seed, version: inserted.rows[0].version }
  const concurrent = await run<ConfigRow>(`SELECT payload, version FROM campaign_config WHERE id = 'primary'`)
  if (!concurrent.rows[0]) throw new Error("CAMPAIGN_CONFIG_SEED_FAILED")
  return { config: normalizeCampaignConfig(concurrent.rows[0].payload), version: concurrent.rows[0].version }
}

export function getCampaignConfig() {
  return ensureConfig()
}

export async function saveCampaignConfig(input: unknown) {
  const config = normalizeCampaignConfig(input)
  const result = await query<ConfigRow>(
    `INSERT INTO campaign_config (id, payload, version, updated_at)
     VALUES ('primary', $1::jsonb, 1, now())
     ON CONFLICT (id) DO UPDATE
       SET payload = EXCLUDED.payload, version = campaign_config.version + 1, updated_at = now()
     RETURNING payload, version`,
    [JSON.stringify(config)]
  )
  return { config: normalizeCampaignConfig(result.rows[0].payload), version: result.rows[0].version }
}

function discountFor(campaign: Campaign, subtotalPaise: number) {
  let discount = campaign.discountType === "percent"
    ? Math.round(subtotalPaise * campaign.discountValue / 100)
    : toMinorUnits(campaign.discountValue)
  if (campaign.maxDiscountRupees > 0) discount = Math.min(discount, toMinorUnits(campaign.maxDiscountRupees))
  return Math.max(0, Math.min(discount, Math.max(0, subtotalPaise - 100)))
}

function campaignInWindow(campaign: Campaign, now: number) {
  if (!campaign.active) return false
  if (campaign.startAt && new Date(campaign.startAt).getTime() > now) return false
  if (campaign.endAt && new Date(campaign.endAt).getTime() <= now) return false
  return true
}

function campaignMatches(campaign: Campaign, tierId: string, selectedProductIds: string[], subtotalPaise: number, trigger: CampaignTrigger) {
  if (campaign.trigger !== trigger) return false
  if (subtotalPaise < toMinorUnits(campaign.minSubtotalRupees)) return false
  if (campaign.eligibleTierIds.length && !campaign.eligibleTierIds.includes(tierId)) return false
  if (campaign.eligibleProductIds.length && !selectedProductIds.some((id) => campaign.eligibleProductIds.includes(id))) return false
  return true
}

async function customerHasOrder(client: PoolClient, customerAccountId: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM orders WHERE customer_account_id = $1 AND status <> 'cancelled') AS exists`,
    [customerAccountId]
  )
  return Boolean(result.rows[0]?.exists)
}

async function usageAvailable(client: PoolClient, campaign: Campaign, customerAccountId: string) {
  if (campaign.totalLimit > 0) {
    const used = await client.query<CountRow>(
      `SELECT (
         (SELECT count(*) FROM orders WHERE campaign_id = $1 AND status <> 'cancelled') +
         (SELECT count(*) FROM offer_quotes WHERE campaign_id = $1 AND redeemed_at IS NULL AND expires_at > now())
       )::int AS count`,
      [campaign.id]
    )
    if ((used.rows[0]?.count || 0) >= campaign.totalLimit) return false
  }
  if (campaign.perCustomerLimit > 0) {
    const used = await client.query<CountRow>(
      `SELECT (
         (SELECT count(*) FROM orders WHERE campaign_id = $1 AND customer_account_id = $2 AND status <> 'cancelled') +
         (SELECT count(*) FROM offer_quotes WHERE campaign_id = $1 AND customer_account_id = $2 AND redeemed_at IS NULL AND expires_at > now())
       )::int AS count`,
      [campaign.id, customerAccountId]
    )
    if ((used.rows[0]?.count || 0) >= campaign.perCustomerLimit) return false
  }
  return true
}

function toOfferQuote(row: QuoteRow, campaign: Campaign): OfferQuote {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    badge: campaign.badge,
    message: campaign.message,
    trigger: row.trigger,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    payablePaise: row.payable_paise,
    expiresAt: row.expires_at.toISOString()
  }
}

export async function createBestOfferQuote(input: {
  customerAccountId: string
  tierId: string
  selectedProductIds: string[]
  trigger: CampaignTrigger
  catalog: CatalogConfig
}) {
  const tier = tierById(input.catalog, input.tierId)
  if (!tier) throw new CampaignError("INVALID_TIER")
  const selectedProductIds = Array.from(new Set(input.selectedProductIds)).sort()
  const subtotalPaise = toMinorUnits(tier.price)

  return transaction(async (client) => {
    await ensureConfig(client)
    const locked = await client.query<ConfigRow>(`SELECT payload, version FROM campaign_config WHERE id = 'primary' FOR UPDATE`)
    const config = normalizeCampaignConfig(locked.rows[0]?.payload || emptyCampaignConfig)
    const now = Date.now()
    const hasPriorOrder = await customerHasOrder(client, input.customerAccountId)
    const candidates = config.campaigns
      .filter((campaign) => campaignInWindow(campaign, now))
      .filter((campaign) => campaignMatches(campaign, tier.id, selectedProductIds, subtotalPaise, input.trigger))
      .filter((campaign) => campaign.audience !== "first_order" || !hasPriorOrder)
      .map((campaign) => ({ campaign, discountPaise: discountFor(campaign, subtotalPaise) }))
      .filter((item) => item.discountPaise > 0)
      .sort((a, b) => b.discountPaise - a.discountPaise)

    for (const candidate of candidates) {
      const campaign = candidate.campaign
      const existing = await client.query<QuoteRow>(
        `SELECT id, campaign_id, campaign_title, customer_account_id, trigger, tier_id, selected_product_ids,
                subtotal_paise, discount_paise, payable_paise, expires_at, redeemed_at
           FROM offer_quotes
          WHERE campaign_id = $1 AND customer_account_id = $2 AND trigger = $3 AND tier_id = $4
            AND selected_product_ids = $5::text[] AND redeemed_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC LIMIT 1`,
        [campaign.id, input.customerAccountId, input.trigger, tier.id, selectedProductIds]
      )
      if (existing.rows[0]) return toOfferQuote(existing.rows[0], campaign)
      if (!(await usageAvailable(client, campaign, input.customerAccountId))) continue

      const expiresAt = new Date(Date.now() + validation.campaign.offerQuoteTtlSeconds * 1000)
      const quoteId = randomUUID()
      const payablePaise = subtotalPaise - candidate.discountPaise
      const inserted = await client.query<QuoteRow>(
        `INSERT INTO offer_quotes (
           id, campaign_id, campaign_title, customer_account_id, trigger, tier_id, selected_product_ids,
           subtotal_paise, discount_paise, payable_paise, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, campaign_id, campaign_title, customer_account_id, trigger, tier_id, selected_product_ids,
                   subtotal_paise, discount_paise, payable_paise, expires_at, redeemed_at`,
        [quoteId, campaign.id, campaign.name, input.customerAccountId, input.trigger, tier.id, selectedProductIds,
          subtotalPaise, candidate.discountPaise, payablePaise, expiresAt]
      )
      return toOfferQuote(inserted.rows[0], campaign)
    }
    return null
  })
}

export async function resolveOrderPricing(
  client: PoolClient,
  quoteId: unknown,
  customerAccountId: string,
  order: NormalizedOrder
): Promise<OrderPricing> {
  const noOffer: OrderPricing = {
    subtotalPaise: order.amountPaise,
    discountPaise: 0,
    payablePaise: order.amountPaise,
    campaignId: null,
    campaignTitle: null,
    offerQuoteId: null
  }
  const rawQuoteId = String(quoteId ?? "").trim()
  if (!rawQuoteId) return noOffer
  if (!isUuidV4(rawQuoteId)) throw new CampaignError("INVALID_OFFER_QUOTE")

  const result = await client.query<QuoteRow>(
    `SELECT id, campaign_id, campaign_title, customer_account_id, trigger, tier_id, selected_product_ids,
            subtotal_paise, discount_paise, payable_paise, expires_at, redeemed_at
       FROM offer_quotes WHERE id = $1 FOR UPDATE`,
    [rawQuoteId]
  )
  const quote = result.rows[0]
  if (!quote) throw new CampaignError("OFFER_QUOTE_NOT_FOUND")
  if (quote.customer_account_id !== customerAccountId) throw new CampaignError("OFFER_QUOTE_OWNER_MISMATCH")
  if (quote.redeemed_at) throw new CampaignError("OFFER_QUOTE_USED")
  if (quote.expires_at.getTime() <= Date.now()) throw new CampaignError("OFFER_QUOTE_EXPIRED")
  if (quote.tier_id !== order.tierId || quote.subtotal_paise !== order.amountPaise) throw new CampaignError("OFFER_QUOTE_MISMATCH")
  const selected = [...order.selectedProductIds].sort()
  if (JSON.stringify(selected) !== JSON.stringify([...quote.selected_product_ids].sort())) throw new CampaignError("OFFER_QUOTE_MISMATCH")

  return {
    subtotalPaise: quote.subtotal_paise,
    discountPaise: quote.discount_paise,
    payablePaise: quote.payable_paise,
    campaignId: quote.campaign_id,
    campaignTitle: quote.campaign_title,
    offerQuoteId: quote.id
  }
}

export async function markOfferQuoteRedeemed(client: PoolClient, quoteId: string | null) {
  if (!quoteId) return
  const updated = await client.query(
    `UPDATE offer_quotes SET redeemed_at = now() WHERE id = $1 AND redeemed_at IS NULL`,
    [quoteId]
  )
  if (!updated.rowCount) throw new CampaignError("OFFER_QUOTE_USED")
}
