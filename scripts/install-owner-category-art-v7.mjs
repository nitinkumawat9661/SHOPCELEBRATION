#!/usr/bin/env node
import sharp from "sharp"
import pg from "pg"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
const prefix="catalog/editorial/category-v7/"
const entries=[
 ["Premium Anti-Tarnish Necklaces","premium-necklaces","c5e3dbef-6d9f-4c2f-b06a-a9a1f8276778"],
 ["Necklace + Earrings Sets","necklace-earring-sets","fff33bb8-ba9e-4ca4-b4b6-19e2ff4574f8"],
 ["Trending Necklaces","trending-necklaces","eb14aa60-8a80-4a87-9551-ac512b4e2b98"],
 ["Gold-Plated Bangles & Bracelets","bangles-bracelets","1d42179d-acf2-4e7b-a465-7722ce5f4191"],
 ["Adjustable Rings","adjustable-rings","a4930dd2-6f88-4e2a-9b7c-65735f83d423"],
 ["Earrings","earrings","05de6ae6-9769-4f63-b5c7-5cf8bb3297f7"],
 ["__all__","all-jewellery","47bb1f95-0b05-4e61-8499-e545e6eb4c6d"],
 ["__hamper__","custom-hampers","6b6a8767-e3ef-4984-a4de-beb39552930b"]
]
const root="https://d2ol7oe51mr4n9.cloudfront.net/user_3KQjOaQLt91OVbqaTV6Tb6NgxEq/"
const path=slug=>prefix+slug+".webp"
const imageUrl=slug=>"/api/catalog/image?key="+encodeURIComponent(path(slug))
for(const key of ["DATABASE_URL","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"])
 if(!process.env[key])throw Error("Missing configuration: "+key)
const r2=new S3Client({region:"auto",endpoint:"https://"+process.env.R2_ACCOUNT_ID+".r2.cloudflarestorage.com",
 credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}})
const bucket=process.env.R2_BUCKET
const db=new pg.Client({connectionString:process.env.DATABASE_URL,
 ssl:process.env.DATABASE_SSL_MODE==="disable"?false:{rejectUnauthorized:true}})
async function valid(slug){
 try{
  const h=await r2.send(new HeadObjectCommand({Bucket:bucket,Key:path(slug)}))
  return h.ContentType==="image/webp"&&Number(h.ContentLength)>12000
 }catch(e){
  if(e?.$metadata?.httpStatusCode===404||["NotFound","NoSuchKey"].includes(e?.name))return false
  throw e
 }
}
async function prepare(mediaId){
 const response=await fetch(root+mediaId+".png",{signal:AbortSignal.timeout(45000),redirect:"error"})
 if(!response.ok)throw Error("Owner artwork fetch HTTP "+response.status)
 const raw=Buffer.from(await response.arrayBuffer())
 if(raw.length<25000||raw.length>8000000)throw Error("Bad source size")
 const m=await sharp(raw).metadata()
 if(m.width!==1254||m.height!==1254)throw Error("Unexpected image dimensions")
 const mask=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><circle cx="320" cy="320" r="316" fill="white"/></svg>')
 const webp=await sharp(raw).resize(640,640).ensureAlpha()
   .composite([{input:mask,blend:"dest-in"}]).webp({quality:83,alphaQuality:95,effort:4}).toBuffer()
 if(webp.length<12000||webp.length>700000)throw Error("Invalid transformed WebP size")
 return webp
}
await db.connect()
try{
 const rows=await db.query("SELECT category_id,image_url FROM home_category_media WHERE category_id=ANY($1::text[])",[entries.map(e=>e[0])])
 const previous=new Map(rows.rows.map(r=>[r.category_id,r.image_url]))
 if(entries.some(([id])=>id!=="Earrings"&&!previous.has(id)))
  throw Error("Missing existing category mapping")
 for(const [id,slug] of entries){
  const old=previous.get(id)
  if(old && old!==imageUrl(slug) && !/category-v[1-6](?:%2F|\/)/i.test(old))
   throw Error("Conflicting newer image for "+id)
 }
 for(const [id,slug,mediaId] of entries){
  if(!await valid(slug)){
   const bytes=await prepare(mediaId)
   await r2.send(new PutObjectCommand({Bucket:bucket,Key:path(slug),Body:bytes,
    ContentLength:bytes.length,ContentType:"image/webp",CacheControl:"public,max-age=31536000,immutable"}))
  }
  if(!await valid(slug))throw Error("Could not persist "+id)
 }
 if(entries.some(([id,slug])=>previous.get(id)!==imageUrl(slug))){
  await db.query("BEGIN")
  try{
   for(const [id,slug] of entries){
    if(previous.get(id)===imageUrl(slug))continue
    const fields=[imageUrl(slug),"owner-provided:2026-10-12:final-round-art",
      "Celebration owner","Owner-supplied category illustration; not listing media",640,640]
    if(previous.has(id)){
     const updated=await db.query("UPDATE home_category_media SET image_url=$1,source_page=$2,photographer=$3,license_name=$4,width=$5,height=$6,updated_at=now() WHERE category_id=$7 AND image_url=$8",
       [...fields,id,previous.get(id)])
     if(updated.rowCount!==1)throw Error("Concurrent media modification for "+id)
    }else{
