#!/usr/bin/env node
/**
 * Owner-approved exact image assignments for the Celebration category rail.
 * This is navigation-only editorial art, NOT the SKU merchandising gallery.
 *
 * One-time handoff: download the six files the owner uploaded in the ChatGPT
 * conversation; make seven WebPs by additionally isolating the pendant in
 * the All Jewellery image for Premium Necklaces (no invented seventh photo).
 * Upload to persistent Cloudflare R2, HEAD-verify every file, atomically write
 * correct PostgreSQL category IDs. Retry-safe across subsequent deployments:
 * once v6 is installed, no temporary source URLs are accessed again.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import pg from "pg"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..")
const prefix="catalog/editorial/category-v6/"
const items=[
  {id:"Premium Anti-Tarnish Necklaces",slug:"premium-necklaces",source:"all",crop:[420,210,480,580]},
  {id:"Necklace + Earrings Sets",slug:"necklace-earring-sets",source:"set"},
  {id:"Trending Necklaces",slug:"trending-necklaces",source:"trending"},
  {id:"Gold-Plated Bangles & Bracelets",slug:"bangles-bracelets",source:"bangles"},
  {id:"Adjustable Rings",slug:"adjustable-rings",source:"rings"},
  {id:"__all__",slug:"all-jewellery",source:"all"},
  {id:"__hamper__",slug:"custom-hampers",source:"hamper"}
]
const required=["DATABASE_URL","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"]
for(const key of required) if(!process.env[key]?.trim()) throw new Error(`Missing category-media environment variable ${key}`)
const r2=new S3Client({
  region:"auto",
  endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}
})
const bucket=process.env.R2_BUCKET
const db=new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL_MODE==="disable"?false:{rejectUnauthorized:true}
})
const keyFor=(item)=>`${prefix}${item.slug}.webp`
const urlFor=(item)=>`/api/catalog/image?key=${encodeURIComponent(keyFor(item))}`

async function objectIsValid(key) {
  try {
    const head=await r2.send(new HeadObjectCommand({Bucket:bucket,Key:key}))
    return head.ContentType==="image/webp" && Number(head.ContentLength)>10000
  } catch(error) {
    if(error?.$metadata?.httpStatusCode===404||["NotFound","NoSuchKey"].includes(error?.name))return false
    throw error
  }
}
function circleMask() {
  return Buffer.from(`<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><circle cx="320" cy="320" r="315" fill="white"/></svg>`)
}
async function downloadSource(name,urls,cache){
  if(cache.has(name))return cache.get(name)
  const address=urls?.[name]
  if(typeof address!=="string")throw new Error(`Approved source image missing for ${name}`)
  const loc=new URL(address)
  if(loc.protocol!=="https:"||loc.hostname!=="d2jqrm6oza8nb6.cloudfront.net"||
     !/^\/datasets\/[a-f0-9-]{36}\.png$/.test(loc.pathname)||!loc.searchParams.get("_jwt"))
    throw new Error(`Invalid temporary approved-image source URL for ${name}`)
  let last
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(address,{signal:AbortSignal.timeout(45000),redirect:"error",cache:"no-store"})
      if(!response.ok)throw new Error(`HTTP ${response.status}`)
      if(!/^image\/(png|jpeg|webp)/i.test(response.headers.get("content-type")||""))
        throw new Error("Source did not return an image")
      const data=Buffer.from(await response.arrayBuffer())
      if(data.length<15000||data.length>12*1024*1024)throw new Error("Incorrect source image size")
      const meta=await sharp(data,{limitInputPixels:24_000_000}).metadata()
      if(meta.width!==1254||meta.height!==1254)throw new Error("Source artwork dimensions are not 1254x1254")
      cache.set(name,data)
      return data
    }catch(err){
      last=err
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,(attempt+1)*800))
    }
  }
  throw new Error(`Failed to retrieve original owner-uploaded ${name} artwork: ${String(last?.message||last)}`)
}
async function compose(item,source) {
  let base=sharp(source).rotate()
  if(item.crop){
    const [left,top,width,height]=item.crop
    base=base.extract({left,top,width,height})
  }
  const prepared=await base.resize(640,640,{
    fit:item.crop?"contain":"cover",
    background:{r:243,g:224,b:219,alpha:1}
  }).ensureAlpha().png().toBuffer()
  const circle=await sharp(prepared).composite([{input:circleMask(),blend:"dest-in"}])
    .webp({quality:84,effort:4,alphaQuality:95}).toBuffer()
  const {data,info}=await sharp(circle).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const alpha=(x,y)=>data[(y*info.width+x)*info.channels+3]
  if(info.width!==640||info.height!==640||circle.length<10000||circle.length>650000||
    alpha(0,0)>12||alpha(639,0)>12||alpha(0,639)>12||alpha(639,639)>12||alpha(320,320)<245)
    throw new Error(`Circular WebP failed quality checks: ${item.slug}`)
  return circle
}
await db.connect()
try {
  const res=await db.query("SELECT category_id,image_url FROM home_category_media WHERE category_id=ANY($1::text[])",[items.map(item=>item.id)])
  const previous=new Map(res.rows.map(row=>[row.category_id,row.image_url]))
  if(previous.size!==7)throw new Error("All 7 existing category rows must be present")

  const ready=items.every(item=>previous.get(item.id)===urlFor(item))
  const newer=items.every(item=>decodeURIComponent(previous.get(item.id)||"").includes("category-v7/"))
  if(newer){ console.log("Preserving final owner v7 category media") }
  else if(ready) {
    for(const item of items)if(!await objectIsValid(keyFor(item)))
      throw new Error(`Published v6 category media missing in R2: ${item.slug}`)
    console.log("Seven owner-approved category media assets already live (7/7)")
  } else {
    for(const item of items){
      const old=previous.get(item.id)
      if(old!==urlFor(item) && !old.includes("category-v5%2F"))
        throw new Error(`Preserving newer/customized category image for ${item.slug}`)
    }
    const manifest=JSON.parse(await readFile(path.join(root,"scripts/owner-category-sources-v6.json"),"utf8"))
    const source=manifest.source_urls
    if(!source || Object.keys(source).length!==6)
      throw new Error("Expect exactly six owner-approved image references")
    const cache=new Map()
    // R2 objects staged BEFORE the SQL transaction, avoiding half-updated cards.
    for(const item of items){
      const key=keyFor(item)
      if(!await objectIsValid(key)){
        const original=await downloadSource(item.source,source,cache)
        const image=await compose(item,original)
        await r2.send(new PutObjectCommand({
          Bucket:bucket,Key:key,Body:image,ContentLength:image.length,
          ContentType:"image/webp",CacheControl:"public,max-age=31536000,immutable"
        }))
        console.log(`Stored owner-approved ${item.slug}: ${image.length} bytes`)
      }
      if(!await objectIsValid(key))throw new Error(`R2 image verification failed: ${item.slug}`)
    }
    await db.query("BEGIN")
    try{
      for(const item of items){
        const result=await db.query(`UPDATE home_category_media
          SET image_url=$1,source_page=$2,photographer=$3,license_name=$4,
              width=640,height=640,updated_at=now()
          WHERE category_id=$5 AND image_url=$6`,[
          urlFor(item),"owner-provided:2026-10-12:category-images",
          "Celebration (owner-provided)","Approved category editorial artwork; not SKU listing media",
          item.id,previous.get(item.id)
        ])
        if(result.rowCount!==1)throw new Error(`Concurrent category update: ${item.slug}`)
      }
      await db.query("COMMIT")
    }catch(error){
      await db.query("ROLLBACK")
      throw error
    }
    console.log("Installed six supplied photos into seven exact category IDs (7/7); all stored in R2 and SQL")
  }
} finally {
  await db.end()
  r2.destroy()
}
