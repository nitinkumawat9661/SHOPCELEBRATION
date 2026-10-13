import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { query, transaction } from "./db"
import { deleteSelfBuildPrivatePhoto, readSelfBuildPrivatePhoto, uploadSelfBuildPrivatePhoto } from "./r2"
import { SelfBuildDraftError } from "./self-build-drafts"

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const MAX_SELF_BUILD_PHOTO_BYTES=3*1024*1024
export const MAX_SELF_BUILD_PHOTOS=40

export async function processSelfBuildPhoto(bytes:Buffer,contentType:string){
  if(bytes.length<1||bytes.length>MAX_SELF_BUILD_PHOTO_BYTES||
    !["image/jpeg","image/png","image/webp"].includes(contentType))
    throw new SelfBuildDraftError("INVALID_PERSONALISED_PHOTO")
  try{
    const img=sharp(bytes,{limitInputPixels:16_000_000,failOn:"error"})
    const meta=await img.metadata()
    if(!["jpeg","png","webp"].includes(meta.format||""))throw new Error("PHOTO_FORMAT_MISMATCH")
    // Rotate then re-encode without EXIF/XMP/GPS metadata. No customer
    // submitted filename, path, MIME or SVG is ever used as an R2 key.
    const clean=await img.rotate().resize({width:1080,height:1080,fit:"inside",withoutEnlargement:true})
      .webp({quality:80,effort:4}).toBuffer()
    if(clean.length<1||clean.length>MAX_SELF_BUILD_PHOTO_BYTES)throw new Error("ENCODE_TOO_LARGE")
    return clean
  }catch{throw new SelfBuildDraftError("INVALID_PERSONALISED_PHOTO")}
}

type PhotoRow={id:string;object_key:string;image_bytes:number;created_at:Date}
export async function listSelfBuildPhotos(accountId:string){
  const r=await query<PhotoRow>(`SELECT p.id::text,p.image_bytes,p.created_at
    FROM self_build_draft_photos p
    JOIN self_build_drafts d ON d.id=p.draft_id
    WHERE p.customer_account_id=$1 AND d.customer_account_id=$1 AND d.expires_at>now()
    ORDER BY p.created_at,p.id`,[accountId])
  return r.rows.map(v=>({id:v.id,sizeBytes:v.image_bytes,createdAt:v.created_at.toISOString()}))
}
export async function uploadSelfBuildDraftPhoto(accountId:string,bytes:Buffer,contentType:string){
  const clean=await processSelfBuildPhoto(bytes,contentType)
  const photoId=randomUUID()
  const result=await transaction(async client=>{
    const d=await client.query<{id:string;selections:{kind:string;id:string;quantity:number}[]}>(
      `SELECT id,selections FROM self_build_drafts
        WHERE customer_account_id=$1 AND expires_at>now() FOR UPDATE`,[accountId])
    const draft=d.rows[0]
    if(!draft)throw new SelfBuildDraftError("ACTIVE_DRAFT_REQUIRED",409)
    const c=await client.query<{id:string}>(`SELECT id FROM self_build_categories
      WHERE selection_kind='photo' AND active=true`)
    const ids=new Set(c.rows.map(v=>v.id))
    const photoQuantity=draft.selections.reduce((n,x)=>
      x.kind==="category"&&ids.has(x.id)&&Number.isSafeInteger(x.quantity)?n+x.quantity:n,0)
    if(photoQuantity<1)throw new SelfBuildDraftError("PHOTO_CATEGORY_SELECTION_REQUIRED",409)
    const existing=await client.query<{count:string}>(`SELECT count(*)::text AS count
      FROM self_build_draft_photos WHERE draft_id=$1`,[draft.id])
    const count=Number(existing.rows[0]?.count||0)
    if(count>=MAX_SELF_BUILD_PHOTOS||count>=photoQuantity)
      throw new SelfBuildDraftError("PHOTO_QUANTITY_LIMIT",409)
    const key=`self-build/private/${draft.id}/${photoId}.webp`
    await uploadSelfBuildPrivatePhoto(key,clean)
    try{
      await client.query(`INSERT INTO self_build_draft_photos
        (id,draft_id,customer_account_id,object_key,image_bytes)
        VALUES ($1::uuid,$2,$3,$4,$5)`,[photoId,draft.id,accountId,key,clean.length])
    }catch(e){
      try{await deleteSelfBuildPrivatePhoto(key)}catch(cleanupError){
        console.error("self-build-photo-insert-cleanup",cleanupError)
      }
      throw e
    }
    return {id:photoId,sizeBytes:clean.length}
  })
  return result
}
export async function readOwnedSelfBuildPhoto(accountId:string,photoId:string){
  if(!UUID.test(photoId))throw new SelfBuildDraftError("PHOTO_NOT_FOUND",404)
  const r=await query<{object_key:string}>(`SELECT p.object_key
    FROM self_build_draft_photos p
    JOIN self_build_drafts d ON d.id=p.draft_id
    WHERE p.id=$1::uuid AND p.customer_account_id=$2
      AND d.customer_account_id=$2 AND d.expires_at>now()`,[photoId,accountId])
  if(!r.rows[0])throw new SelfBuildDraftError("PHOTO_NOT_FOUND",404)
  return readSelfBuildPrivatePhoto(r.rows[0].object_key)
}
export async function deleteOwnedSelfBuildPhoto(accountId:string,photoId:string){
  if(!UUID.test(photoId))throw new SelfBuildDraftError("PHOTO_NOT_FOUND",404)
  await transaction(async client=>{
    const r=await client.query<{object_key:string}>(`SELECT p.object_key
      FROM self_build_draft_photos p
      JOIN self_build_drafts d ON d.id=p.draft_id
      WHERE p.id=$1::uuid AND p.customer_account_id=$2 AND d.customer_account_id=$2
      FOR UPDATE OF p`,[photoId,accountId])
    const key=r.rows[0]?.object_key
    if(!key)throw new SelfBuildDraftError("PHOTO_NOT_FOUND",404)
    await deleteSelfBuildPrivatePhoto(key)
    await client.query("DELETE FROM self_build_draft_photos WHERE id=$1::uuid AND customer_account_id=$2",
      [photoId,accountId])
  })
}
