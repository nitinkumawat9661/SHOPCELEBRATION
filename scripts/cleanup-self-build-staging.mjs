#!/usr/bin/env node
/**
 * VPS-only self-build staging cleanup.
 * Removes expired *unpaid draft* images from private R2 and stale draft DB rows.
 * Never auto-releases paid/payment-pending order reservations: that requires
 * payment-provider reconciliation to avoid a late-capture/stock oversell.
 *
 * Production invocation uses @next/env to load the release env, e.g.
 * node -e "require('@next/env').loadEnvConfig(process.cwd(), false); import('./scripts/cleanup-self-build-staging.mjs')"
 */
import { randomUUID } from "node:crypto"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import pg from "pg"

const connectionString=process.env.DATABASE_URL?.trim()
const ssl=process.env.DATABASE_SSL_MODE==="disable"?false:{rejectUnauthorized:true}
if(!connectionString)throw Error("DATABASE_URL_REQUIRED")
const required=["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"]
const photoKeysConfig=required.map(k=>process.env[k])
// Only require R2 configuration if expired photo rows actually exist. This
// preserves fail-safe cleanup of drafts with zero photos during R2 outages.
const pool=new pg.Pool({connectionString,ssl,max:2})
let r2=null
function storage(){
  if(r2)return r2
  if(photoKeysConfig.some(x=>!x))throw Error("SELF_BUILD_CLEANUP_R2_CONFIG_MISSING")
  r2=new S3Client({
    region:"auto",endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}
  })
  return r2
}
const photoKey=/^self-build\/private\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/
async function run(){
  const lock=await pool.connect()
  let cleanedDrafts=0,cleanedPhotos=0,unreconciled=0
  try{
    const lockRow=await lock.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",["celebration:self-build:cleanup:v1"])
    if(!lockRow.rows[0]?.locked){console.log("SELF_BUILD_CLEANUP_ALREADY_RUNNING");return}
    // Limit batches to avoid long-running maintenance while checkout is live.
    for(let i=0;i<5;i++){
      const exp=await lock.query(
        "SELECT id FROM self_build_drafts WHERE expires_at<now() ORDER BY expires_at LIMIT 20")
      if(!exp.rows.length)break
      for(const row of exp.rows){
        await lock.query("BEGIN")
        try{
          const draft=await lock.query(
            "SELECT id FROM self_build_drafts WHERE id=$1 AND expires_at<now() FOR UPDATE",[row.id])
          if(!draft.rowCount){await lock.query("COMMIT");continue}
          const files=await lock.query(
            "SELECT object_key FROM self_build_draft_photos WHERE draft_id=$1 FOR UPDATE",[row.id])
          for(const file of files.rows){
            if(typeof file.object_key!=="string"||!photoKey.test(file.object_key))
              throw Error("SELF_BUILD_CLEANUP_INVALID_PHOTO_KEY")
            await storage().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:file.object_key}))
          }
          await lock.query("DELETE FROM self_build_drafts WHERE id=$1",[row.id])
          await lock.query("COMMIT")
          cleanedDrafts++
          cleanedPhotos+=files.rows.length
        }catch(error){
          await lock.query("ROLLBACK")
          throw error // abort, never silently orphan sensitive images
        }
      }
    }
    // Merely report expired holds. Do NOT release them without authoritative
    // payment state reconciliation; a provider may report success later.
    const pending=await lock.query(`SELECT count(*)::integer AS n
      FROM self_build_order_reservation_batches
      WHERE status='reserved' AND expires_at<now()`)
    unreconciled=pending.rows[0]?.n||0
    console.log(JSON.stringify({service:"self-build-staging-cleanup",
      removedExpiredDrafts:cleanedDrafts,removedPrivatePhotos:cleanedPhotos,
      expiredHoldsAwaitingPaymentReconciliation:unreconciled}))
    await lock.query("SELECT pg_advisory_unlock(hashtextextended($1,0))",["celebration:self-build:cleanup:v1"])
  } finally {lock.release();await pool.end();r2?.destroy()}
}
await run()
