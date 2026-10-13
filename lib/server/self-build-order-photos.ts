import type { PoolClient } from "pg"
import { query } from "./db"
import { readSelfBuildPrivatePhoto } from "./r2"
import { SelfBuildReservationError } from "./self-build-reservations"
import { isSafePublicOrderId } from "../validation/identifiers"

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function reject(code:string):never {throw new SelfBuildReservationError(code)}

// Called only with the same PoolClient as BOTH staged order creation and
// category-capacity reservation. Physical private R2 bytes are not moved or
// copied; only the object-key ownership metadata moves from draft to order.
// The source rows are removed INSIDE the transaction so expired draft cleanup
// cannot delete order-owned photos. Rollback preserves the original draft.
export async function transferSelfBuildPhotosToOrderWithClient(client:PoolClient,input:{
  orderId:string;draftId:string;accountId:string;expectedCount:number;created:boolean
}){
  if(!input.orderId||!input.accountId||!UUID.test(input.draftId)||
    !Number.isSafeInteger(input.expectedCount)||input.expectedCount<0||input.expectedCount>40)
    reject("SELF_BUILD_ORDER_PHOTOS_INVALID")
  const existing=await client.query<{id:string;source_draft_id:string}>(`
    SELECT id::text,source_draft_id FROM self_build_order_photos
    WHERE order_id=$1 ORDER BY id FOR UPDATE`,[input.orderId])
  if(existing.rows.length){
    if(input.created||existing.rows.length!==input.expectedCount||
      existing.rows.some(p=>p.source_draft_id!==input.draftId))
      reject("SELF_BUILD_ORDER_PHOTO_REPLAY_MISMATCH")
    const newer=await client.query<{id:string}>(`
      SELECT id::text FROM self_build_draft_photos WHERE draft_id=$1
      AND customer_account_id=$2 LIMIT 1`,[input.draftId,input.accountId])
    if(newer.rows.length)reject("SELF_BUILD_ORDER_PHOTO_REPLAY_MISMATCH")
    return {transferred:false,count:existing.rows.length}
  }
  if(!input.created) {
    if(input.expectedCount>0)reject("SELF_BUILD_ORDER_PHOTO_REPLAY_MISMATCH")
    const leftovers=await client.query(`
      SELECT id FROM self_build_draft_photos WHERE draft_id=$1
      AND customer_account_id=$2 LIMIT 1`,[input.draftId,input.accountId])
    if(leftovers.rows.length)reject("SELF_BUILD_ORDER_PHOTO_REPLAY_MISMATCH")
    return {transferred:false,count:0}
  }
  const owned=await client.query<{id:string;object_key:string;image_bytes:number}>(`
    SELECT id::text,object_key,image_bytes FROM self_build_draft_photos
    WHERE draft_id=$1 AND customer_account_id=$2 ORDER BY created_at,id FOR UPDATE`,
    [input.draftId,input.accountId])
  if(owned.rows.length!==input.expectedCount)
    reject("SELF_BUILD_ORDER_PHOTO_COUNT_MISMATCH")
  if(input.expectedCount===0)return {transferred:false,count:0}
  const exactOrder=await client.query<{id:string}>(`
    SELECT id FROM orders WHERE id=$1 AND customer_account_id=$2 AND order_type='hamper'
    FOR UPDATE`,[input.orderId,input.accountId])
  if(!exactOrder.rows[0])reject("SELF_BUILD_ORDER_PHOTO_OWNER_MISMATCH")
  const inserted=await client.query(`
    INSERT INTO self_build_order_photos (id,order_id,source_draft_id,object_key,image_bytes)
    SELECT id,$1,draft_id,object_key,image_bytes
    FROM self_build_draft_photos
    WHERE draft_id=$2 AND customer_account_id=$3`,[input.orderId,input.draftId,input.accountId])
  if(inserted.rowCount!==input.expectedCount)reject("SELF_BUILD_ORDER_PHOTO_TRANSFER_FAILED")
  const erased=await client.query(`
    DELETE FROM self_build_draft_photos WHERE draft_id=$1 AND customer_account_id=$2`,
    [input.draftId,input.accountId])
  if(erased.rowCount!==input.expectedCount)reject("SELF_BUILD_ORDER_PHOTO_TRANSFER_FAILED")
  return {transferred:true,count:input.expectedCount}
}

export async function listSelfBuildOrderPhotosForAdmin(publicId:string){
  if(!isSafePublicOrderId(publicId))return null
  const result=await query<{id:string;deleted_at:Date|null;transferred_at:Date;delivered_at:Date|null}>(`
    SELECT p.id::text,p.deleted_at,p.transferred_at,o.delivered_at
    FROM self_build_order_photos p JOIN orders o ON o.id=p.order_id
    WHERE o.public_id=$1
    ORDER BY p.transferred_at,p.id`,[publicId])
  // No internal object keys or customer photo bytes leave this response.
  return result.rows.map(p=>({
    id:p.id,createdAt:p.transferred_at.toISOString(),
    deleted:Boolean(p.deleted_at),
    deletedAt:p.deleted_at?.toISOString()??null,
    scheduledDeleteAfter:p.delivered_at
      ?new Date(p.delivered_at.getTime()+48*60*60*1000).toISOString():null
  }))
}
export async function readSelfBuildOrderPhotoForAdmin(publicId:string,photoId:string){
  if(!isSafePublicOrderId(publicId)||!UUID.test(photoId))return null
  const rows=await query<{object_key:string}>(`
    SELECT p.object_key FROM self_build_order_photos p
    JOIN orders o ON o.id=p.order_id
    WHERE o.public_id=$1 AND p.id=$2::uuid AND p.deleted_at IS NULL
      AND p.object_key IS NOT NULL
      AND (o.status<>'delivered' OR
           (o.delivered_at IS NOT NULL AND o.delivered_at>now()-interval '48 hours'))
    LIMIT 1`,[publicId,photoId])
  const key=rows.rows[0]?.object_key
  if(!key)return null
  return readSelfBuildPrivatePhoto(key)
}
