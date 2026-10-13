// SELF-BUILD NO-STOCK CHECKOUT: internal server primitive only.
// Customer chooses categories/options; Celebration chooses actual goods.
// Deliberately DOES NOT read or update ANY stock, capacity, reservation,
// quantity-on-hand or retailer inventory table. Stock management is out of scope.
import type { PoolClient } from "pg"
import type { CreateOrderInput } from "../../domain/order"
import { normalizeOrderInput } from "../../domain/order"
import { requireEnv } from "../../../config/env"
import { SELF_BUILD_DELIVERY_FEE_PAISE } from "../../../config/self-build-delivery"
import { normalizeCatalogConfig } from "../catalog"
import { transaction } from "../db"
import { parseDraftBody } from "../self-build-drafts"
import { transferSelfBuildPhotosToOrderWithClient } from "../self-build-order-photos"
import { createOrderWithClient } from "./create"
import { countSelfBuildPieces, getSelfBuildTierLimits } from "../self-build-tier-limits"
import { evaluatePrivateSelfBuildChoices, type PrivateCategory, type PrivateOption } from "../self-build-private-budget"

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export class SelfBuildCheckoutError extends Error {
  constructor(public readonly code:string){super(code)}
}
function reject(code:string):never {throw new SelfBuildCheckoutError(code)}

export type SelfBuildNoStockInput={
  accountId:string
  draftId:string
  customerDetails:CreateOrderInput
  paymentProvider:"razorpay"|"cashfree"
}


export async function createSelfBuildNoInventoryWithClient(client:PoolClient,input:SelfBuildNoStockInput) {
  if(!input||typeof input.accountId!=="string"||!input.accountId||
      typeof input.draftId!=="string"||!UUID.test(input.draftId)||
      !input.customerDetails||typeof input.customerDetails!=="object"||
      !["razorpay","cashfree"].includes(input.paymentProvider))
    reject("SELF_BUILD_INVALID_CHECKOUT")

  // The production CHECK(customer_enabled=false) is still active. This call
  // cannot create a live Self-Build order unless launch is separately approved.
  const gate=await client.query<{version:number;customer_enabled:boolean;show_item_prices:boolean;allow_multiple_quantities:boolean}>(
    "SELECT version,customer_enabled,show_item_prices,allow_multiple_quantities FROM self_build_configuration WHERE id='primary' FOR SHARE")
  const config=gate.rows[0]
  if(!config||config.customer_enabled!==true||config.show_item_prices!==false)
    reject("SELF_BUILD_NOT_LIVE")
  const account=await client.query<{id:string;phone:string}>(
    "SELECT id,phone FROM customer_accounts WHERE id=$1 AND status='active' AND phone_verified_at IS NOT NULL",
    [input.accountId])
  if(!account.rows[0])reject("SELF_BUILD_ACCOUNT_NOT_VERIFIED")
  const draft=await client.query<{tier_id:string;selections:unknown;other_request_text:string}>(
    `SELECT tier_id,selections,other_request_text FROM self_build_drafts
      WHERE id=$1 AND customer_account_id=$2 AND expires_at>now() FOR UPDATE`,
    [input.draftId,input.accountId])
  if(!draft.rows[0])reject("SELF_BUILD_DRAFT_NOT_FOUND")
  const saved=draft.rows[0]
  const choices=parseDraftBody({tierId:saved.tier_id,selections:saved.selections,
    otherRequestText:saved.other_request_text}).selections

  // Trusted live tier selling price + tier maxChoices, never a posted
  // price or owner stock figure. Private item budgets remain server-side only.
  const catalog=await client.query<{payload:unknown}>(
    "SELECT payload FROM catalog_config WHERE id='primary' FOR SHARE")
  if(!catalog.rows[0])reject("CATALOG_NOT_INITIALIZED")
  const published=normalizeCatalogConfig(catalog.rows[0].payload)
  const chosenTier=published.tiers.find(t=>t.id===saved.tier_id&&t.active!==false)
  if(!chosenTier)reject("SELF_BUILD_TIER_UNAVAILABLE")
  const limits=getSelfBuildTierLimits(chosenTier)
  if(countSelfBuildPieces(choices)>limits.maxItems)reject("SELF_BUILD_MAX_ITEMS_EXCEEDED")
  // Category & size costs are private budgets, not inventory or retail SKU
  // prices. Allow the owner's 5-point tolerance above the standard target.
  const [cats,opts]=await Promise.all([
    client.query<PrivateCategory>("SELECT id,parent_id,selection_kind,charge_mode,unit_budget_paise,label,active FROM self_build_categories ORDER BY id"),
    client.query<PrivateOption>("SELECT id,category_id,unit_budget_paise,label,active FROM self_build_options ORDER BY id")
  ])
  let checkedChoices:ReturnType<typeof evaluatePrivateSelfBuildChoices>
  try {
    checkedChoices=evaluatePrivateSelfBuildChoices(choices,cats.rows,opts.rows,
      config.allow_multiple_quantities,limits.ceilingPaise)
  }catch(error){
    reject(error instanceof Error?error.message:"SELF_BUILD_PRIVATE_BUDGET_INVALID")
  }
  const normalized=normalizeOrderInput({
    ...input.customerDetails,
    orderType:"hamper",tierId:saved.tier_id,selectedProductIds:[],
    phone:account.rows[0].phone,paymentReference:null
  },requireEnv("businessTimezone"),published,
  {requirePaymentReference:false,checkExpectedSubtotal:false})

  // Existing hamper createOrderWithClient DOES NOT invoke retail inventory;
  // the new flow never calls reservation/stock/capacity services.
  const order=await createOrderWithClient(client,normalized,input.accountId,undefined,{
    paymentProvider:input.paymentProvider,
    selfBuildShippingPaise:SELF_BUILD_DELIVERY_FEE_PAISE
  })
  const result=await client.query<{id:string}>(
    `SELECT id FROM orders WHERE public_id=$1 AND customer_account_id=$2
      AND idempotency_key=$3 AND order_type='hamper' AND tier_id=$4`,
    [order.publicId,input.accountId,normalized.idempotencyKey,saved.tier_id])
  const orderId=result.rows[0]?.id
  if(!orderId)reject("SELF_BUILD_ORDER_NOT_FOUND")
  const existing=await client.query<{
    selections:unknown;other_request_text:string;total_internal_budget_paise:number;
    tier_budget_paise:number
  }>(
    "SELECT selections,other_request_text,total_internal_budget_paise,tier_budget_paise FROM self_build_order_snapshots WHERE order_id=$1",
    [orderId])
  if(!order.created){
    const match=existing.rows[0]
    const sameChoices=Array.isArray(match?.selections)&&
      match.selections.length===checkedChoices.snap.length &&
      match.selections.every((item:unknown,index:number)=>{
        const record=item&&typeof item==="object"&&!Array.isArray(item)
          ?item as Record<string,unknown>:null
        const expected=checkedChoices.snap[index]
        return record?.kind===expected.kind&&record?.id===expected.id&&
          record?.label===expected.label&&record?.quantity===expected.quantity
      })
    if(!match||!sameChoices||
       match.other_request_text!==saved.other_request_text.trim()||
       match.total_internal_budget_paise!==checkedChoices.spent||
       match.tier_budget_paise!==limits.ceilingPaise)
      reject("SELF_BUILD_IDEMPOTENCY_PAYLOAD_MISMATCH")
  }else{
    await client.query(`
      INSERT INTO self_build_order_snapshots
      (order_id,rules_version,tier_id,selections,total_internal_budget_paise,tier_budget_paise,other_request_text)
      VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`,
      [orderId,config.version,saved.tier_id,JSON.stringify(checkedChoices.snap),
       checkedChoices.spent,limits.ceilingPaise,saved.other_request_text.trim()])
  }
  await transferSelfBuildPhotosToOrderWithClient(client,{
    orderId,draftId:input.draftId,accountId:input.accountId,
    expectedCount:checkedChoices.photoCount,created:order.created
  })
  return {orderId:order.publicId,payablePaise:order.pricing.payablePaise,created:order.created}
}

export function createSelfBuildNoInventoryOrder(input:SelfBuildNoStockInput){
  return transaction(client=>createSelfBuildNoInventoryWithClient(client,input))
}
