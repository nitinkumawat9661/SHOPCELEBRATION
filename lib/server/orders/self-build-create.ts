// INTERNAL, NOT EXPOSED AS AN API ROUTE: stage one customer Self-Build
// hamper using the existing order/pricing/event writer and the category-only
// stock reservation ledger, IN ONE PostgreSQL transaction.
//
// The production DB hard gate customer_enabled=false remains intact.
// Caller must separately finish paid-photo retention and provider payment
// lifecycle before introducing any shopper checkout endpoint.
import type { PoolClient } from "pg"
import type { CreateOrderInput } from "../../domain/order"
import { normalizeOrderInput } from "../../domain/order"
import { requireEnv } from "../../../config/env"
import { normalizeCatalogConfig } from "../catalog"
import { transaction } from "../db"
import { parseDraftBody } from "../self-build-drafts"
import { reserveSelfBuildForOrderWithClient, SelfBuildReservationError } from "../self-build-reservations"
import { createOrderWithClient } from "./create"
import { transferSelfBuildPhotosToOrderWithClient } from "../self-build-order-photos"

type StageInput = {
  accountId: string
  draftId: string
  customerDetails: CreateOrderInput
  paymentProvider: "razorpay" | "cashfree"
}

const DRAFT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fail(code:string):never { throw new SelfBuildReservationError(code) }

export async function createStagedSelfBuildOrderWithClient(client: PoolClient, input: StageInput) {
  if(!input||!input.accountId||typeof input.accountId!=="string"||
     typeof input.draftId!=="string"||!DRAFT_ID.test(input.draftId)||
     !input.customerDetails||typeof input.customerDetails!=="object"||
     !["razorpay","cashfree"].includes(input.paymentProvider))
    fail("INVALID_SELF_BUILD_ORDER_INPUT")

  // Lock the hard DB gate before creating any order (same transaction). The
  // CHECK(customer_enabled=false) remains enforced on every production DB.
  const gate=await client.query<{customer_enabled:boolean;show_item_prices:boolean}>(
    "SELECT customer_enabled,show_item_prices FROM self_build_configuration WHERE id='primary' FOR SHARE")
  if(gate.rows[0]?.customer_enabled!==true||gate.rows[0]?.show_item_prices!==false)
    fail("SELF_BUILD_NOT_LIVE")

  const account=await client.query<{id:string;phone:string}>(
    "SELECT id,phone FROM customer_accounts WHERE id=$1 AND status='active' AND phone_verified_at IS NOT NULL",
    [input.accountId])
  if(!account.rows[0])fail("SELF_BUILD_ACCOUNT_NOT_VERIFIED")
  const draft=await client.query<{
    id:string;tier_id:string;selections:unknown;other_request_text:string
  }>(
    `SELECT id,tier_id,selections,other_request_text FROM self_build_drafts
      WHERE id=$1 AND customer_account_id=$2 AND expires_at>now() FOR UPDATE`,
    [input.draftId,input.accountId])
  const saved=draft.rows[0]
  if(!saved)fail("SELF_BUILD_DRAFT_NOT_FOUND")

  // Re-parse stored JSON rather than accepting any posted choices, costs or
  // retail SKU. Price comes from the currently published tier, not the draft.
  const selections=parseDraftBody({
    tierId:saved.tier_id,selections:saved.selections,
    otherRequestText:saved.other_request_text
  }).selections
  if(!selections.length)fail("EMPTY_SELF_BUILD_SELECTIONS")
  const chosenCategoryIds=selections.filter(s=>s.kind==="category").map(s=>s.id)
  const photo=await client.query<{id:string}>(`
    SELECT id FROM self_build_categories
    WHERE id=ANY($1::text[]) AND selection_kind='photo'`,[chosenCategoryIds])
  const photoCategories=new Set(photo.rows.map(row=>row.id))
  const expectedPhotoCount=selections.reduce((count,selection)=>
    selection.kind==="category"&&photoCategories.has(selection.id)
      ?count+selection.quantity:count,0)
  if(expectedPhotoCount>40)fail("SELF_BUILD_ORDER_PHOTO_COUNT_MISMATCH")
  const catalog=await client.query<{payload:unknown}>(
    "SELECT payload FROM catalog_config WHERE id='primary' FOR SHARE")
  if(!catalog.rows[0])fail("CATALOG_NOT_INITIALIZED")
  const checked=normalizeOrderInput({
    ...input.customerDetails,
    orderType:"hamper",
    tierId:saved.tier_id,
    selectedProductIds:[],
    phone:account.rows[0].phone,
    paymentReference:null
  },requireEnv("businessTimezone"),normalizeCatalogConfig(catalog.rows[0].payload),
  {requirePaymentReference:false,checkExpectedSubtotal:false})

  // This is the SAME transaction as the order row and notification outbox.
  // Roll back all three if the stock, tier, permissions or private budget fail.
  const order=await createOrderWithClient(client,checked,input.accountId,undefined,{
    paymentProvider:input.paymentProvider
  })
  const row=await client.query<{id:string}>(
    `SELECT id FROM orders WHERE public_id=$1 AND idempotency_key=$2
      AND customer_account_id=$3 AND order_type='hamper' AND tier_id=$4`,
    [order.publicId,checked.idempotencyKey,input.accountId,saved.tier_id])
  if(!row.rows[0])fail("SELF_BUILD_ORDER_LOOKUP_FAILED")

  // Never attach a Self-Build reservation to a prior curated hamper just
  // because someone reused a UUID/idempotency key from an existing checkout.
  if(!order.created){
    const existing=await client.query<{order_id:string}>(
      "SELECT order_id FROM self_build_order_snapshots WHERE order_id=$1",
      [row.rows[0].id])
    if(!existing.rows[0])fail("SELF_BUILD_IDEMPOTENCY_COLLISION")
  }
  const reservation=await reserveSelfBuildForOrderWithClient(client,{
    orderId:row.rows[0].id,
    accountId:input.accountId,
    tierId:saved.tier_id,
    selections,
    note:saved.other_request_text,
    expiresAt:new Date(Date.now()+15*60*1000)
  })
  // Transfer private draft-photo ownership to the order in this SAME
  // transaction. R2 bytes remain private and will be deleted only after
  // actual delivery completion + 48h, never on shipment/label creation.
  await transferSelfBuildPhotosToOrderWithClient(client,{
    orderId:row.rows[0].id,draftId:input.draftId,accountId:input.accountId,
    expectedCount:expectedPhotoCount,created:order.created
  })
  return {
    orderId:order.publicId,
    payablePaise:order.pricing.payablePaise,
    created:order.created,
    reservationStatus:reservation.status
  }
}

// Internal orchestration only: never invoke this from public /api/orders or
// /api/payments/create until all launch gates are signed off.
export function createStagedSelfBuildOrder(input:StageInput){
  return transaction(client=>createStagedSelfBuildOrderWithClient(client,input))
}
