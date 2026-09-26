import type { PoolClient } from "pg"
import { createHash, randomUUID } from "node:crypto"
import { orderEvents } from "../../../config/order-events"
import { orderConfig } from "../../../config/order"
import { securityConfig } from "../../../config/security"
import { validation } from "../../../config/validation"
import type { PaymentProviderName } from "../../../config/payment-gateway"
import type { NormalizedOrder } from "../../domain/order"
import { createTrackingToken, trackingTokenHash } from "../../security/tokens"
import { markOfferQuoteRedeemed, resolveOrderPricing, type OrderPricing } from "../campaigns"
import { transaction } from "../db"
import { createPublicOrderId } from "../order-id"
import { appendOrderEvent } from "./events"

type ExistingOrder = {
  public_id: string
  customer_account_id: string | null
  subtotal_paise: number
  discount_paise: number
  amount_paise: number
  campaign_id: string | null
  campaign_title: string | null
  offer_quote_id: string | null
}

type CreateOrderOptions = {
  paymentProvider?: PaymentProviderName | null
}

function existingPricing(row: ExistingOrder): OrderPricing {
  return {
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    payablePaise: row.amount_paise,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    offerQuoteId: row.offer_quote_id
  }
}

async function findExisting(client: PoolClient, idempotencyKey: string) {
  const existing = await client.query<ExistingOrder>(
    `SELECT public_id, customer_account_id, subtotal_paise, discount_paise, amount_paise,
            campaign_id, campaign_title, offer_quote_id
       FROM orders WHERE idempotency_key = $1`,
    [idempotencyKey]
  )
  return existing.rows[0] || null
}

async function insertOrder(
  client: PoolClient,
  input: NormalizedOrder,
  customerAccountId: string,
  offerQuoteId?: unknown,
  options: CreateOrderOptions = {}
) {
  const trackingToken = createTrackingToken(input.idempotencyKey)
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [input.idempotencyKey])
  const already = await findExisting(client, input.idempotencyKey)
  if (already) {
    if (already.customer_account_id !== customerAccountId) throw new Error("IDEMPOTENCY_OWNER_MISMATCH")
    return { publicId: already.public_id, trackingToken, pricing: existingPricing(already) }
  }

  const pricing = await resolveOrderPricing(client, offerQuoteId, customerAccountId, input)
  const internalId = randomUUID()
  const publicId = createPublicOrderId()
  const trackingHash = trackingTokenHash(trackingToken)
  const expiresAt = new Date(Date.now() + validation.trackingTokenTtlSeconds * 1000)
  const paymentReferenceHash = input.paymentReference
    ? createHash(securityConfig.hashAlgorithm).update(input.paymentReference).digest("hex")
    : null
  const automatedPayment = Boolean(options.paymentProvider)
  const initialPaymentStatus = automatedPayment ? "pending" : orderConfig.initialPaymentStatus

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO orders (
      id, public_id, idempotency_key, tracking_token_hash, tracking_expires_at,
      tier_id, tier_name, subtotal_paise, discount_paise, amount_paise, campaign_id, campaign_title, offer_quote_id,
      selected_product_ids, selected_product_names,
      required_date, occasion, customer_name, phone, receiver_name,
      address, city, state, pincode, gift_message,
      payment_reference, payment_reference_hash, payment_status, payment_provider,
      status, policy_version, customer_account_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id`,
    [
      internalId,
      publicId,
      input.idempotencyKey,
      trackingHash,
      expiresAt,
      input.tierId,
      input.tierName,
      pricing.subtotalPaise,
      pricing.discountPaise,
      pricing.payablePaise,
      pricing.campaignId,
      pricing.campaignTitle,
      pricing.offerQuoteId,
      input.selectedProductIds,
      input.selectedProductNames,
      input.requiredDate,
      input.occasion,
      input.customerName,
      input.phone,
      input.receiverName,
      input.address,
      input.city,
      input.state,
      input.pincode,
      input.message,
      input.paymentReference,
      paymentReferenceHash,
      initialPaymentStatus,
      options.paymentProvider || null,
      orderConfig.initialStatus,
      input.policyVersion,
      customerAccountId
    ]
  )

  if (!inserted.rowCount) {
    const existing = await findExisting(client, input.idempotencyKey)
    if (!existing) throw new Error("IDEMPOTENCY_LOOKUP_FAILED")
    if (existing.customer_account_id !== customerAccountId) throw new Error("IDEMPOTENCY_OWNER_MISMATCH")
    return { publicId: existing.public_id, trackingToken, pricing: existingPricing(existing) }
  }

  await markOfferQuoteRedeemed(client, pricing.offerQuoteId)
  await appendOrderEvent(client, internalId, orderEvents.created, {
    status: orderConfig.initialStatus,
    paymentStatus: initialPaymentStatus,
    paymentProvider: options.paymentProvider || null,
    customerAccountId,
    subtotalPaise: pricing.subtotalPaise,
    discountPaise: pricing.discountPaise,
    payablePaise: pricing.payablePaise,
    campaignId: pricing.campaignId
  })
  return { publicId, trackingToken, pricing }
}

export function createOrder(
  input: NormalizedOrder,
  customerAccountId: string,
  offerQuoteId?: unknown,
  options: CreateOrderOptions = {}
) {
  return transaction((client) => insertOrder(client, input, customerAccountId, offerQuoteId, options))
}
