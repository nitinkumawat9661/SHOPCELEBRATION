import { randomUUID } from "node:crypto"
import { query, transaction } from "./db"
import type { SelfBuildSelection } from "./self-build-quote"
import { getSelfBuildPublishedCatalog } from "./self-build-published-tiers"
import { deleteSelfBuildPrivatePhoto } from "./r2"
import { countSelfBuildPieces, getSelfBuildTierLimits, parseSelfBuildBoxId, validateSelfBuildPackaging, type SelfBuildBoxId } from "./self-build-tier-limits"
import { evaluatePrivateSelfBuildChoices, type PrivateCategory, type PrivateOption } from "./self-build-private-budget"

const ID=/^[a-z0-9][a-z0-9-]{0,59}$/
const MAX_SELECTIONS=100

export class SelfBuildDraftError extends Error {
  constructor(public readonly code:string,public readonly status=422){super(code)}
}
function reject(code:string,status=422):never { throw new SelfBuildDraftError(code,status) }
export function parseDraftBody(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input))reject("INVALID_SELF_BUILD_DRAFT")
  const v=input as Record<string,unknown>
  if(typeof v.tierId!=="string"||!ID.test(v.tierId))reject("INVALID_TIER")
  if(!Array.isArray(v.selections)||v.selections.length>MAX_SELECTIONS)reject("INVALID_DRAFT_SELECTIONS")
  if(typeof v.otherRequestText!=="string"||v.otherRequestText.length>1200||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.otherRequestText))reject("INVALID_OTHER_REQUEST")
  const seen=new Set<string>()
  const selections:SelfBuildSelection[]=v.selections.map((entry:unknown)=>{
    if(!entry||typeof entry!=="object"||Array.isArray(entry))reject("INVALID_DRAFT_SELECTION")
    const e=entry as Record<string,unknown>
    if((e.kind!=="category"&&e.kind!=="option")||
      typeof e.id!=="string"||!ID.test(e.id)||
      !Number.isSafeInteger(e.quantity)||Number(e.quantity)<1||Number(e.quantity)>100)
      reject("INVALID_DRAFT_SELECTION")
    const key=e.kind+":"+e.id
    if(seen.has(key))reject("DUPLICATE_DRAFT_SELECTION")
    seen.add(key)
    return {kind:e.kind as SelfBuildSelection["kind"],id:e.id,quantity:e.quantity as number}
  })
  return {tierId:v.tierId,selections,otherRequestText:v.otherRequestText.trim(),boxId:parseSelfBuildBoxId(v.boxId)}
}
export async function customerSelfBuildEnabled(){
  const result=await query<{customer_enabled:boolean}>("SELECT customer_enabled FROM self_build_configuration WHERE id='primary'")
  // Fail closed if migration not applied.
  return result.rows[0]?.customer_enabled===true
}
type DraftRow={id:string;tier_id:string;selections:SelfBuildSelection[];other_request_text:string;expires_at:Date;box_id:SelfBuildBoxId|null}
export async function getSelfBuildDraft(accountId:string) {
  const result=await query<DraftRow>(
    `SELECT id,tier_id,selections,other_request_text,expires_at,box_id
       FROM self_build_drafts WHERE customer_account_id=$1 AND expires_at>now() LIMIT 1`,[accountId])
  const item=result.rows[0]
  if(!item)return null
  return {id:item.id,tierId:item.tier_id,selections:item.selections,
    otherRequestText:item.other_request_text,expiresAt:item.expires_at.toISOString(),boxId:item.box_id}
}
export async function saveSelfBuildDraft(accountId:string,input:unknown){
  const clean=parseDraftBody(input)
  const catalog=await getSelfBuildPublishedCatalog()
  const tier=catalog.tiers.find(t=>t.id===clean.tierId&&t.active!==false)
  if(!tier)reject("TIER_UNAVAILABLE")
  const limits=getSelfBuildTierLimits(tier)
  if(countSelfBuildPieces(clean.selections)>limits.maxItems)
    reject("SELF_BUILD_MAX_ITEMS_EXCEEDED")
  // A draft is NOT a quote, purchase or a promise of category inventory.
  // Reject unknown/deactivated category IDs but NEVER derive retail product IDs.
  return transaction(async client=>{
    const settings=await client.query<{allow_multiple_quantities:boolean;customer_enabled:boolean}>(
      "SELECT allow_multiple_quantities,customer_enabled FROM self_build_configuration WHERE id='primary' FOR SHARE")
    if(settings.rows[0]?.customer_enabled!==true)reject("SELF_BUILD_NOT_LIVE",403)
    // Existing unboxed drafts may be edited but can never proceed to payment.
    // Only owner-approved complete packaging costs are accepted for new box picks.
    if(clean.boxId){
      const cost=await client.query<{approved:boolean;total_cost_paise:number|null}>(
        "SELECT approved,total_cost_paise FROM self_build_packaging_costs WHERE box_id=$1 FOR SHARE",
        [clean.boxId])
      try{validateSelfBuildPackaging(tier,clean.boxId,cost.rows[0])}
      catch(error){reject(error instanceof Error?error.message:"SELF_BUILD_BOX_INVALID")}
    }
    const cats=await client.query<PrivateCategory>(
      "SELECT id,parent_id,selection_kind,charge_mode,unit_budget_paise,label,active FROM self_build_categories")
    const options=await client.query<PrivateOption>(
      "SELECT id,category_id,unit_budget_paise,label,active FROM self_build_options")
    const byId=new Map(cats.rows.map(c=>[c.id,c]))
    const byOpt=new Map(options.rows.map(o=>[o.id,o]))
    for(const chosen of clean.selections){
      if(!settings.rows[0].allow_multiple_quantities&&chosen.quantity>1)reject("MULTIPLE_QUANTITIES_DISABLED")
      if(chosen.kind==="category"){
        const c=byId.get(chosen.id)
        if(!c||!c.active||!["category","photo"].includes(c.selection_kind)||
          (c.parent_id&&!byId.get(c.parent_id)?.active))reject("CATEGORY_UNAVAILABLE")
      }else{
        const o=byOpt.get(chosen.id)
        const p=o?byId.get(o.category_id):null
        if(!o||!o.active||!p||!p.active||p.selection_kind!=="variant")reject("OPTION_UNAVAILABLE")
      }
    }
    // Validate private amounts at SAVE time as well as at PURCHASE time.
    // The buyer receives only a generic error code; costs and unit budgets
    // are never serialized. No stock/capacity/SKU tables are consulted.
    try{
      evaluatePrivateSelfBuildChoices(clean.selections,cats.rows,options.rows,
        settings.rows[0].allow_multiple_quantities,limits.ceilingPaise)
    }catch(error){
      reject(error instanceof Error?error.message:"SELF_BUILD_PRIVATE_BUDGET_INVALID")
    }
    // Id is preserved across saves so uploaded private photos can stay linked.
    const existing=await client.query<{id:string;expires_at:Date}>(
      "SELECT id,expires_at FROM self_build_drafts WHERE customer_account_id=$1 FOR UPDATE",[accountId])
    const existingId=existing.rows[0]?.id
    if(existingId){
      const photos=await client.query<{object_key:string}>(
        "SELECT object_key FROM self_build_draft_photos WHERE draft_id=$1 FOR UPDATE",[existingId])
      const selectedPhotoCount=clean.selections.reduce((n,item)=>{
        const c=item.kind==="category"?byId.get(item.id):null
        return c?.selection_kind==="photo"?n+item.quantity:n
      },0)
      if(existing.rows[0].expires_at<=new Date()){
        for(const p of photos.rows)await deleteSelfBuildPrivatePhoto(p.object_key)
        await client.query("DELETE FROM self_build_draft_photos WHERE draft_id=$1",[existingId])
      }else if(photos.rows.length>selectedPhotoCount){
        reject("REMOVE_EXCESS_DRAFT_PHOTOS_BEFORE_SAVING",409)
      }
    }
    const id=existing.rows[0]?.id||randomUUID()
    await client.query(`INSERT INTO self_build_drafts
      (id,customer_account_id,tier_id,selections,other_request_text,box_id,expires_at)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,now()+interval '14 days')
      ON CONFLICT(customer_account_id) DO UPDATE SET
       tier_id=EXCLUDED.tier_id,selections=EXCLUDED.selections,
       other_request_text=EXCLUDED.other_request_text,box_id=EXCLUDED.box_id,
       expires_at=EXCLUDED.expires_at,
       updated_at=now()`,
      [id,accountId,clean.tierId,JSON.stringify(clean.selections),clean.otherRequestText,clean.boxId])
    const row=await client.query<DraftRow>(
      "SELECT id,tier_id,selections,other_request_text,expires_at,box_id FROM self_build_drafts WHERE customer_account_id=$1",
      [accountId])
    return {id:row.rows[0].id,tierId:row.rows[0].tier_id,selections:row.rows[0].selections,
      otherRequestText:row.rows[0].other_request_text,expiresAt:row.rows[0].expires_at.toISOString(),
      boxId:row.rows[0].box_id}
  })
}
export async function deleteSelfBuildDraft(accountId:string) {
  // Customer deletion removes private R2 bytes as well as DB metadata.
  await transaction(async client=>{
    const draft=await client.query<{id:string}>(
      "SELECT id FROM self_build_drafts WHERE customer_account_id=$1 FOR UPDATE",[accountId])
    if(!draft.rows[0])return
    const photos=await client.query<{object_key:string}>(`
      SELECT object_key FROM self_build_draft_photos
      WHERE draft_id=$1 AND customer_account_id=$2 FOR UPDATE`,
      [draft.rows[0].id,accountId])
    for(const p of photos.rows)await deleteSelfBuildPrivatePhoto(p.object_key)
    await client.query("DELETE FROM self_build_drafts WHERE customer_account_id=$1",[accountId])
  })
}
export async function countDraftPhotos(accountId:string,draftId:string){
  const result=await query<{count:string}>(`SELECT COUNT(*)::text AS count
    FROM self_build_draft_photos WHERE customer_account_id=$1 AND draft_id=$2`,[accountId,draftId])
  return Number(result.rows[0]?.count||0)
}
