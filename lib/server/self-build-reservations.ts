import type { PoolClient } from "pg"
import type { SelfBuildSelection, PrivateBudgetResult } from "./self-build-quote"
import { evaluateSelfBuildBudget } from "./self-build-quote"
import type { SelfBuildAdminState } from "./self-build-admin"
import type { SelfBuildCapacityState } from "./self-build-capacity"

// INTERNAL TRANSACTIONAL PRIMITIVES ONLY. No public handler calls these.
// The caller MUST be an order-creation/payment transaction; never reserve
// un-paid customer drafts. The DB customer gate stays OFF until launch.
export class SelfBuildReservationError extends Error {
  constructor(public readonly code:string){super(code)}
}
function fail(code:string):never {throw new SelfBuildReservationError(code)}
type Row={id:string;customer_account_id:string|null;order_type:string;tier_id:string|null}
type Config={version:number;customer_enabled:boolean;show_item_prices:boolean;allow_multiple_quantities:boolean;default_catalog_item_budget_paise:number;other_request_prompt:string}
type RawCategory={id:string;parent_id:string|null;label:string;selection_kind:"group"|"category"|"variant"|"photo"|"notes";charge_mode:"none"|"per_unit"|"once_per_category"|"option";unit_budget_paise:number|null;display_order:number;active:boolean}
type RawOption={id:string;category_id:string;label:string;unit_budget_paise:number;display_order:number;active:boolean}
type RawCategoryCapacity={category_id:string;available_units:number;reserved_units:number;verified:boolean}
type RawOptionCapacity={option_id:string;available_units:number;reserved_units:number;verified:boolean}
type RawAllowance={tier_id:string;allowance_paise:number;enabled:boolean}
type RawBatch={order_id:string;status:string;tier_id:string;expires_at:Date}
const ID=/^[a-z0-9][a-z0-9-]{0,59}$/

async function lockAndRead(client:PoolClient,tierId:string){
  // Exact lock order shared with admin category/capacity writes.
  const settings=await client.query<Config>(
    "SELECT * FROM self_build_configuration WHERE id='primary' FOR SHARE")
  const control=await client.query<{version:number}>(
    "SELECT version FROM self_build_capacity_control WHERE id='primary' FOR UPDATE")
  const config=settings.rows[0],state=control.rows[0]
  if(!config||!state||config.customer_enabled!==true||config.show_item_prices!==false)
    fail("SELF_BUILD_NOT_LIVE")
  const cats=await client.query<RawCategory>("SELECT * FROM self_build_categories ORDER BY id")
  const opts=await client.query<RawOption>("SELECT * FROM self_build_options ORDER BY id")
  // Lock category/option capacity rows before computing a quote, and hold until
  // the same transaction has inserted the order snapshot + reservations.
  const ccap=await client.query<RawCategoryCapacity>("SELECT * FROM self_build_category_capacity ORDER BY category_id FOR UPDATE")
  const ocap=await client.query<RawOptionCapacity>("SELECT * FROM self_build_option_capacity ORDER BY option_id FOR UPDATE")
  const tier=await client.query<RawAllowance>("SELECT tier_id,allowance_paise,enabled FROM self_build_tier_allowances WHERE tier_id=$1",[tierId])
  const rules:SelfBuildAdminState={
    version:config.version,
    config:{
      customerEnabled:false,showItemPrices:false,
      allowMultipleQuantities:config.allow_multiple_quantities,
      defaultCatalogItemBudgetPaise:config.default_catalog_item_budget_paise,
      otherRequestPrompt:config.other_request_prompt
    },
    categories:cats.rows.map(c=>({
      id:c.id,parentId:c.parent_id,label:c.label,selectionKind:c.selection_kind,
      chargeMode:c.charge_mode,unitBudgetPaise:c.unit_budget_paise,
      displayOrder:c.display_order,active:c.active
    })),
    options:opts.rows.map(o=>({
      id:o.id,categoryId:o.category_id,label:o.label,
      unitBudgetPaise:o.unit_budget_paise,displayOrder:o.display_order,active:o.active
    }))
  }
  const mapC=new Map(ccap.rows.map(c=>[c.category_id,c]))
  const mapO=new Map(ocap.rows.map(o=>[o.option_id,o]))
  const cap:SelfBuildCapacityState={
    version:state.version,settingsVersion:config.version,
    categories:cats.rows.filter(c=>["category","photo"].includes(c.selection_kind)).map(c=>{
      const row=mapC.get(c.id)
      return {id:c.id,label:c.label,parentLabel:null,active:c.active,
        availableUnits:row?.available_units??0,reservedUnits:row?.reserved_units??0,verified:row?.verified??false}
    }),
    options:opts.rows.map(o=>{
      const row=mapO.get(o.id),parent=cats.rows.find(c=>c.id===o.category_id)
      return {id:o.id,label:o.label,groupLabel:parent?.label||"",active:o.active&&Boolean(parent?.active),
        availableUnits:row?.available_units??0,reservedUnits:row?.reserved_units??0,verified:row?.verified??false}
    }),
    tiers:tier.rows.map(t=>({id:t.tier_id,label:t.tier_id,sellingPricePaise:0,
      allowancePaise:t.allowance_paise,enabled:t.enabled}))
  }
  return {rules,cap}
}

/** Called strictly inside the SAME PoolClient transaction that created order. */
export async function reserveSelfBuildForOrderWithClient(
  client:PoolClient, input:{
    orderId:string;accountId:string;tierId:string;selections:SelfBuildSelection[];
    note:string;expiresAt:Date
  }
) {
  if(!input.orderId||!input.accountId||!ID.test(input.tierId)||
    !(input.expiresAt instanceof Date)||!Number.isFinite(input.expiresAt.getTime())||
    input.expiresAt.getTime()<=Date.now()||input.expiresAt.getTime()>Date.now()+48*60*60*1000||
    typeof input.note!=="string"||input.note.length>1200)
    fail("INVALID_SELF_BUILD_RESERVATION")
  // All reserve/release/commit paths acquire capacity control BEFORE order
  // rows, and are serialized with admin quantity edits.
  const locked=await lockAndRead(client,input.tierId)
  const order=await client.query<Row>(
    "SELECT id,customer_account_id,order_type,tier_id FROM orders WHERE id=$1 FOR UPDATE",[input.orderId])
  const o=order.rows[0]
  if(!o||o.customer_account_id!==input.accountId||o.order_type!=="hamper"||o.tier_id!==input.tierId)
    fail("RESERVATION_ORDER_MISMATCH")
  const existing=await client.query<RawBatch>(
    "SELECT order_id,status,tier_id,expires_at FROM self_build_order_reservation_batches WHERE order_id=$1 FOR UPDATE",[input.orderId])
  if(existing.rows[0]){
    // A duplicate payment/order retry must never add reservations twice.
    // Mismatched data must NOT silently return success.
    if(existing.rows[0].tier_id!==input.tierId)fail("RESERVATION_PAYLOAD_MISMATCH")
    const lines=await client.query<{kind:string;choice_id:string;quantity:number}>(
      "SELECT kind,choice_id,quantity FROM self_build_order_reservation_items WHERE order_id=$1 ORDER BY kind,choice_id",[input.orderId])
    const actual=lines.rows.map(r=>[r.kind,r.choice_id,r.quantity].join(":")).sort()
    const supplied=(Array.isArray(input.selections)?input.selections:[]).map(r=>[r.kind,r.id,r.quantity].join(":")).sort()
    if(JSON.stringify(actual)!==JSON.stringify(supplied))fail("RESERVATION_PAYLOAD_MISMATCH")
    const snap=await client.query<{other_request_text:string}>(
      "SELECT other_request_text FROM self_build_order_snapshots WHERE order_id=$1",[input.orderId])
    if(!snap.rows[0]||snap.rows[0].other_request_text!==input.note.trim())
      fail("RESERVATION_PAYLOAD_MISMATCH")
    if(existing.rows[0].status==="released")fail("RESERVATION_ALREADY_RELEASED")
    return {created:false,status:existing.rows[0].status}
  }
  // A quote is recalculated from LOCKED live data, never trusting a caller's
  // posted budget, stock, tier price or selection labels.
  const result:PrivateBudgetResult=evaluateSelfBuildBudget(input.tierId,input.selections,locked.rules,locked.cap)
  if(!result.ok)fail(result.code)
  const snapshot=input.selections.map(s=>{
    const c=s.kind==="category"?locked.rules.categories.find(c=>c.id===s.id):null
    const o=s.kind==="option"?locked.rules.options.find(o=>o.id===s.id):null
    return {kind:s.kind,id:s.id,label:c?.label||o?.label||"",quantity:s.quantity}
  })
  await client.query(`INSERT INTO self_build_order_snapshots
    (order_id,rules_version,tier_id,selections,total_internal_budget_paise,tier_budget_paise,other_request_text)
    VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
    [input.orderId,locked.rules.version,input.tierId,JSON.stringify(snapshot),
      result.internalSpentPaise,result.allowancePaise,input.note.trim()])
  await client.query(`INSERT INTO self_build_order_reservation_batches
    (order_id,status,rules_version,capacity_version,tier_id,
     internal_spent_paise,tier_allowance_paise,expires_at)
    VALUES ($1,'reserved',$2,$3,$4,$5,$6,$7)`,
    [input.orderId,locked.rules.version,locked.cap.version,input.tierId,
     result.internalSpentPaise,result.allowancePaise,input.expiresAt])
  for(const choice of input.selections){
    const table=choice.kind==="category"?"self_build_category_capacity":"self_build_option_capacity"
    const column=choice.kind==="category"?"category_id":"option_id"
    const changed=await client.query(`UPDATE ${table} SET
      reserved_units=reserved_units+$2,updated_at=now()
      WHERE ${column}=$1 AND verified=true AND available_units-reserved_units >= $2`,
      [choice.id,choice.quantity])
    if(changed.rowCount!==1)fail("INSUFFICIENT_VERIFIED_CATEGORY_CAPACITY")
    await client.query(`INSERT INTO self_build_order_reservation_items
      (order_id,kind,choice_id,quantity) VALUES ($1,$2,$3,$4)`,
      [input.orderId,choice.kind,choice.id,choice.quantity])
  }
  await client.query("UPDATE self_build_capacity_control SET version=version+1,updated_at=now() WHERE id='primary'")
  return {created:true,status:"reserved" as const}
}

/** Release is idempotent and NEVER refunds consumed/committed units. */
export async function releaseSelfBuildReservationWithClient(client:PoolClient,orderId:string){
  await client.query("SELECT version FROM self_build_capacity_control WHERE id='primary' FOR UPDATE")
  const batch=await client.query<RawBatch>(
    "SELECT order_id,status,tier_id FROM self_build_order_reservation_batches WHERE order_id=$1 FOR UPDATE",[orderId])
  if(!batch.rows[0])return {changed:false,status:"not_found" as const}
  if(batch.rows[0].status!=="reserved")return {changed:false,status:batch.rows[0].status}
  const items=await client.query<{kind:"category"|"option";choice_id:string;quantity:number}>(
    "SELECT kind,choice_id,quantity FROM self_build_order_reservation_items WHERE order_id=$1 ORDER BY kind,choice_id",[orderId])
  for(const item of items.rows){
    const table=item.kind==="category"?"self_build_category_capacity":"self_build_option_capacity"
    const col=item.kind==="category"?"category_id":"option_id"
    const result=await client.query(`UPDATE ${table} SET reserved_units=reserved_units-$2,updated_at=now()
      WHERE ${col}=$1 AND reserved_units>=$2`,[item.choice_id,item.quantity])
    if(result.rowCount!==1)fail("RESERVATION_LEDGER_INCONSISTENT")
  }
  await client.query("UPDATE self_build_order_reservation_batches SET status='released',updated_at=now() WHERE order_id=$1",[orderId])
  await client.query("UPDATE self_build_capacity_control SET version=version+1,updated_at=now() WHERE id='primary'")
  return {changed:true,status:"released" as const}
}

/** Commit after trusted payment verification: permanently consume units. */
export async function commitSelfBuildReservationWithClient(client:PoolClient,orderId:string){
  await client.query("SELECT version FROM self_build_capacity_control WHERE id='primary' FOR UPDATE")
  const batch=await client.query<RawBatch>(
    "SELECT order_id,status,tier_id FROM self_build_order_reservation_batches WHERE order_id=$1 FOR UPDATE",[orderId])
  if(!batch.rows[0])fail("RESERVATION_NOT_FOUND")
  if(batch.rows[0].status==="committed")return {changed:false,status:"committed" as const}
  if(batch.rows[0].status!=="reserved")fail("RESERVATION_ALREADY_RELEASED")
  if(batch.rows[0].expires_at<=new Date())fail("RESERVATION_EXPIRED")
  // A payment/order-status mutation and this commit MUST be in one caller
  // transaction. Never mark stock consumed on an unverified payment.
  const payment=await client.query<{payment_status:string}>(
    "SELECT payment_status FROM orders WHERE id=$1 FOR UPDATE",[orderId])
  if(!payment.rows[0]||!["paid","verified"].includes(payment.rows[0].payment_status))
    fail("PAYMENT_NOT_VERIFIED")
  const items=await client.query<{kind:"category"|"option";choice_id:string;quantity:number}>(
    "SELECT kind,choice_id,quantity FROM self_build_order_reservation_items WHERE order_id=$1 ORDER BY kind,choice_id",[orderId])
  for(const item of items.rows){
    const table=item.kind==="category"?"self_build_category_capacity":"self_build_option_capacity"
    const col=item.kind==="category"?"category_id":"option_id"
    const result=await client.query(`UPDATE ${table} SET
      available_units=available_units-$2,reserved_units=reserved_units-$2,updated_at=now()
      WHERE ${col}=$1 AND reserved_units>=$2 AND available_units>=$2`,[item.choice_id,item.quantity])
    if(result.rowCount!==1)fail("RESERVATION_LEDGER_INCONSISTENT")
  }
  await client.query("UPDATE self_build_order_reservation_batches SET status='committed',updated_at=now() WHERE order_id=$1",[orderId])
  await client.query("UPDATE self_build_capacity_control SET version=version+1,updated_at=now() WHERE id='primary'")
  return {changed:true,status:"committed" as const}
}
