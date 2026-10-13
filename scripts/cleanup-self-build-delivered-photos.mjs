#!/usr/bin/env node
// Scheduled VPS-only private Self-Build order-photo lifecycle.
// Delivery COMPLETED + 48 elapsed hours, not ship date, label, booking or ETA.
// Does not touch catalog, packing video, guest uploads or draft photos.
//
// R2 deletion happens BEFORE Postgres marks the photo deleted; network failures
// roll back DB and retry next cron. Never log names, ids, or object keys.
// Runtime / Webhook payment integration remains staged and checkout OFF.
import pg from "pg"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"

const KEY=/^self-build\/private\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/
const LOCK="celebration:self-build:delivered-photo-cleanup:v1"
const LIMIT=120

// A client holds a session-wide advisory lock across all calls. Each photo is
// processed under its OWN transaction, locking the order row against status
// changes during the R2 delete. Retry any failed or interrupted photo safely.
export async function removeDeliveredSelfBuildOrderPhotos(client, remove, limit=LIMIT) {
  if(!Number.isInteger(limit)||limit<1||limit>LIMIT)throw Error("INVALID_PHOTO_CLEANUP_LIMIT")
  if(typeof remove!=="function")throw Error("INVALID_PHOTO_DELETE_CALLBACK")
  let count=0
  for(let i=0;i<limit;i++){
    await client.query("BEGIN")
    try{
      const eligible=await client.query(`
        SELECT p.id,p.object_key
          FROM self_build_order_photos p
          JOIN orders o ON o.id=p.order_id
         WHERE p.deleted_at IS NULL AND p.object_key IS NOT NULL
           AND o.status IN ('delivered','issue_reported','refund_or_replacement_resolved')
           AND o.delivered_at IS NOT NULL
           AND o.delivered_at<=now()-interval '48 hours'
           AND o.payment_status IN ('paid','verified')
           AND NOT EXISTS (SELECT 1 FROM self_build_draft_photos d WHERE d.object_key=p.object_key)
         ORDER BY o.delivered_at,p.id LIMIT 1
         FOR SHARE OF o
         FOR UPDATE OF p SKIP LOCKED`)
      const photo=eligible.rows[0]
      if(!photo){await client.query("COMMIT");break}
      if(typeof photo.object_key!=="string"||!KEY.test(photo.object_key))
        throw Error("SELF_BUILD_ORDER_PHOTO_KEY_INVALID")
      await remove(photo.object_key)
      const changed=await client.query(`
        UPDATE self_build_order_photos
           SET object_key=NULL,deleted_at=now()
         WHERE id=$1::uuid AND deleted_at IS NULL AND object_key=$2
        RETURNING id`,[photo.id,photo.object_key])
      if(changed.rowCount!==1)throw Error("SELF_BUILD_ORDER_PHOTO_CLEANUP_CONFLICT")
      await client.query("COMMIT")
      count++
    }catch(error){
      await client.query("ROLLBACK").catch(()=>{})
      throw error
    }
  }
  return count
}

export async function run() {
  const connectionString=process.env.DATABASE_URL?.trim()
  if(!connectionString)throw Error("DATABASE_URL_REQUIRED")
  const pool=new pg.Pool({
    connectionString,
    ssl:process.env.DATABASE_SSL_MODE==="disable"?false:{rejectUnauthorized:true},
    max:1
  })
  let storage=null,lock=null,hasLock=false
  try{
    lock=await pool.connect()
    const claim=await lock.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",[LOCK])
    if(!claim.rows[0]?.locked){console.log("SELF_BUILD_DELIVERED_PHOTOS_CLEANUP_ALREADY_RUNNING");return}
    hasLock=true
    const remove=async key=>{
      if(!KEY.test(key))throw Error("SELF_BUILD_ORDER_PHOTO_KEY_INVALID")
      const required=["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"]
      if(required.some(k=>!process.env[k]))throw Error("SELF_BUILD_ORDER_PHOTO_STORAGE_NOT_CONFIGURED")
      if(!storage)storage=new S3Client({
        region:"auto",endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials:{
          accessKeyId:process.env.R2_ACCESS_KEY_ID,
          secretAccessKey:process.env.R2_SECRET_ACCESS_KEY
        }
      })
      await storage.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}))
    }
    const removed=await removeDeliveredSelfBuildOrderPhotos(lock,remove)
    console.log(JSON.stringify({service:"self-build-delivered-photo-cleanup",
      deletedPrivatePhotos:removed,windowHours:48,
      note:"Delivery completion only; remaining photos retried next run"}))
  }finally{
    if(lock){
      if(hasLock)await lock.query("SELECT pg_advisory_unlock(hashtextextended($1,0))",[LOCK]).catch(()=>{})
      lock.release()
    }
    await pool.end()
    storage?.destroy()
  }
}

if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
  run().catch(e=>{
    console.error("SELF_BUILD_DELIVERED_PHOTOS_CLEANUP_FAILED")
    process.exitCode=1
  })
}
