// SELF-BUILD NO-STOCK CHECKOUT: internal server primitive only.
// Customer chooses categories/options; Celebration chooses actual goods.
// Deliberately DOES NOT read or update ANY stock, capacity, reservation,
// quantity-on-hand or retailer inventory table. Stock management is out of scope.
import type { PoolClient } from "pg"
import type { CreateOrderInput } from "../../domain/order"
import { normalizeOrderInput } from "../../domain/order"
import { requireEnv } from "../../../config/env"
import { normalizeCatalogConfig } from "../catalog"
import { transaction } from "../db"
import { parseDraftBody } from "../self-build-drafts"
import { transferSelfBuildPhotosToOrderWithClient } from "../self-build-order-photos"
import { createOrderWithClient } from "./create"

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type Choice={kind:"category"|"option";id:string;quantity:number}
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

type Category={id:string;parent_id:string|null;selection_kind:string;charge_mode:string;unit_budget_paise:number|null;label:string;active:boolean}
type Option={id:string;category_id:string;unit_budget_paise:number;label:string;active:boolean}

function evaluateCategoriesOnly(selections:Choice[],cats:Category[],opts:Option[],allowMultiple:boolean,allowance:number) {
  if(!selections.length||!Number.isSafeInteger(allowance)||allowance<=0)reject("SELF_BUILD_BUDGET_NOT_CONFIGURED")
  const categories=new Map(cats.map(c=>[c.id,c]))
  const options=new Map(opts.map(o=>[o.id,o]))
  let spent=0,photoCount=0
  const snap: {kind:Choice["kind"];id:string;label:string;quantity:number}[]=[]
  for(const choice of selections) {
    if(!allowMultiple && choice.quantity>1)reject("SELF_BUILD_MULTIPLE_QUANTITIES_DISABLED")
    let unit:number|null
    let label:string
    if(choice.kind==="category"){
      const category=categories.get(choice.id)
      if(!category||!category.active||!["category","photo"].includes(category.selection_kind)||
         (category.parent_id&&!categories.get(category.parent_id)?.active))
        reject("SELF_BUILD_CATEGORY_UNAVAILABLE")
      if(!["per_unit","once_per_category"].includes(category.charge_mode))
        reject("SELF_BUILD_CATEGORY_UNAVAILABLE")
      if(category.selection_kind==="photo")photoCount+=choice.quantity
      unit=category.unit_budget_paise
      label=category.label
      if(category.charge_mode==="per_unit" && unit!==null)unit*=choice.quantity
    }else{
      const option=options.get(choice.id)
      const parent=option?categories.get(option.category_id):null
      if(!option||!option.active||!parent||!parent.active||parent.selection_kind!=="variant")
        reject("SELF_BUILD_OPTION_UNAVAILABLE")
      unit=option.unit_budget_paise*choice.quantity
      label=option.label
    }
    if(unit===null||!Number.isSafeInteger(unit)||unit<0||unit>2147483647||
       spent>2147483647-unit)reject("SELF_BUILD_PRIVATE_BUDGET_INVALID")
    spent+=unit
    if(spent>allowance)reject("SELF_BUILD_PRIVATE_BUDGET_EXCEEDED")
    snap.push({kind:choice.kind,id:choice.id,label,quantity:choice.quantity})
  }
  if(photoCount>40)reject("SELF_BUILD_PHOTO_LIMIT")
  return {spent,photoCount,snap}
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

  // Internal budgets are owner-defined category/option expenses, NOT stock.
  // Never accept posted pricing, option labels, SKU IDs or costs.
  const [cats,opts,tier]=await Promise.all([
    client.query<Category>("SELECT id,parent_id,selection_kind,charge_mode,unit_budget_paise,label,active FROM self_build_categories ORDER BY id"),
    client.query<Option>("SELECT id,category_id,unit_budget_paise,label,active FROM self_build_options ORDER BY id"),
    client.query<{allowance_paise:number;enabled:boolean}>(
      "SELECT allowance_paise,enabled FROM self_build_tier_allowances WHERE tier_id=$1",[saved.tier_id])
  ])
  if(tier.rows[0]?.enabled!==true)reject("SELF_BUILD_BUDGET_NOT_CONFIGURED")
  const checkedChoices=evaluateCategoriesOnly(choices,cats.rows,opts.rows,
    config.allow_multiple_quantities,tier.rows[0].allowance_paise)

  const catalog=await client.query<{payload:unknown}>(
    "SELECT payload FROM catalog_config WHERE id='primary' FOR SHARE")
  if(!catalog.rows[0])reject("CATALOG_NOT_INITIALIZED")
  const normalized=normalizeOrderInput({
    ...input.customerDetails,
    orderType:"hamper",tierId:saved.tier_id,selectedProductIds:[],
    phone:account.rows[0].phone,paymentReference:null
  },requireEnv("businessTimezone"),normalizeCatalogConfig(catalog.rows[0].payload),
  {requirePaymentReference:false,checkExpectedSubtotal:false})

  // Existing hamper createOrderWithClient DOES NOT invoke retail inventory;
  // the new flow never calls reservation/stock/capacity services.
  const order=await createOrderWithClient(client,normalized,input.accountId,undefined,{
    paymentProvider:input.paymentProvider
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
       match.tier_budget_paise!==tier.rows[0].allowance_paise)
      reject("SELF_BUILD_IDEMPOTENCY_PAYLOAD_MISMATCH")
  }else{
    await client.query(`
      INSERT INTO self_build_order_snapshots
      (order_id,rules_version,tier_id,selections,total_internal_budget_paise,tier_budget_paise,other_request_text)
      VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`,
      [orderId,config.version,saved.tier_id,JSON.stringify(checkedChoices.snap),
       checkedChoices.spent,tier.rows[0].allowance_paise,saved.other_request_text.trim()])
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
