#!/usr/bin/env node
/**
 * Circle-native Celebration category photography v3.
 *
 * Version 2 made rounded RECTANGLES inside a square, then CSS cropped it into
 * a circle. At 90–122px the rectangles looked tiny / cluttered.
 *
 * Version 3 instead gives each category ONE exact-SKU photograph, contained
 * inside a native round field, with an edge-fading round photo mask. The
 * final WebP has a transparent exterior. No square cards, overlaps or fake
 * jewellery geometry. The original product listing images are not changed.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import pg from "pg"
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = JSON.parse(await readFile(path.join(root, "content/catalog.json"), "utf8"))
const byId = new Map(catalog.products.map((product) => [product.id, product]))
const WIDTH = 640
const PREFIX = "catalog/editorial/category-v3/"
const EDITS = [
  { id:"Premium Anti-Tarnish Necklaces", slug:"premium-necklaces", sku:"celebration-necklace-002", palette:["#fff9f4","#f1e1da","#cfae9e"] },
  { id:"Necklace + Earrings Sets", slug:"necklace-earring-sets", sku:"celebration-set-002", palette:["#fffaf8","#f1dfe4","#cea7b5"] },
  { id:"Trending Necklaces", slug:"trending-necklaces", sku:"celebration-necklace-025", palette:["#fffaf9","#ece4ed","#bcb0d0"] },
  { id:"Gold-Plated Bangles & Bracelets", slug:"bangles-bracelets", sku:"celebration-bangle-002", palette:["#fffdf7","#eee1cc","#c9a98d"] },
  { id:"Adjustable Rings", slug:"adjustable-rings", sku:"celebration-ring-002", palette:["#fffcf8","#f1e9e2","#d8bcad"] },
  { id:"__all__", slug:"all-jewellery", sku:"celebration-set-005", palette:["#fffaf8","#ede3d9","#cdb2a3"] },
  // Celebrate genuine items that can be selected for a personalized hamper.
  // No invented prepacked hamper photograph is represented as real merchandise.
  { id:"__hamper__", slug:"custom-hampers", sku:"celebration-necklace-003", palette:["#fff9f6","#efdde0","#c9a4b2"] }
]
const needed = ["DATABASE_URL","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"]
for(const key of needed) if(!process.env[key]?.trim()) throw new Error(`Missing media environment: ${key}`)
const r2 = new S3Client({
  region:"auto",
  endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}
})
const db = new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL_MODE === "disable" ? false : {rejectUnauthorized:true}
})
const bucket = process.env.R2_BUCKET

function ownedProduct(edit) {
  const product=byId.get(edit.sku)
  if(!product || product.active === false || !product.imageUrl) throw new Error(`Missing authentic product ${edit.sku}`)
  if(!edit.id.startsWith("__") && product.category !== edit.id) throw new Error(`Source category mismatch for ${edit.sku}`)
  return product
}
for (const e of EDITS) ownedProduct(e)

async function exactProductPhoto(product){
  const address=product.imageUrl
  let input
  if(address.startsWith("/api/catalog/image?key=")){
    const key=new URL(address,"https://shopcelebration.in").searchParams.get("key") || ""
    if(!/^catalog\/rehost\/meesho\/[a-f0-9]{64}\/main\.webp$/.test(key)) throw new Error(`Non-SKU photo key ${product.id}`)
    const response=await r2.send(new GetObjectCommand({Bucket:bucket,Key:key}))
    if(!response.Body) throw new Error(`SKU source missing: ${product.id}`)
    input=Buffer.from(await response.Body.transformToByteArray())
  } else {
    const url = new URL(address)
    if(url.protocol !== "https:" || url.hostname !== "shopcelebration.in" ||
       !/^\/catalog\/necklaces\/celebration-necklace-\d{3}\.png$/.test(url.pathname) ||
       url.search || url.hash) throw new Error(`Unexpected first-party image for ${product.id}`)
    input=await readFile(path.join(root,"public",url.pathname.slice(1)))
  }
  if(input.length<1000 || input.length>14_000_000) throw new Error(`Invalid source length ${product.id}`)
  const meta=await sharp(input,{limitInputPixels:24_000_000}).metadata()
  if(!meta.width || !meta.height || meta.width<220 || meta.height<220) throw new Error(`Invalid SKU image ${product.id}`)
  return input
}
function baseCircle(edit) {
  const [light,mid,dark]=edit.palette
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <defs>
      <radialGradient id="field" cx="42%" cy="32%" r="78%">
        <stop offset="0" stop-color="${light}"/>
        <stop offset=".71" stop-color="${mid}"/>
        <stop offset="1" stop-color="${dark}"/>
      </radialGradient>
    </defs>
    <circle cx="320" cy="320" r="314" fill="url(#field)"/>
    <circle cx="320" cy="320" r="313" fill="none" stroke="#ffffff" stroke-width="6" opacity=".8"/>
    <circle cx="320" cy="320" r="301" fill="none" stroke="#9c7b78" stroke-opacity=".14" stroke-width="2"/>
  </svg>`)
}
function circularFade(size) {
  const r=size/2
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><radialGradient id="fade" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="white" stop-opacity="1"/>
      <stop offset=".72" stop-color="white" stop-opacity="1"/>
      <stop offset=".91" stop-color="white" stop-opacity=".84"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="${r}" cy="${r}" r="${r}" fill="url(#fade)"/>
  </svg>`)
}
async function containAndFeather(input){
  // Never distort, cut off pendants, or fabricate the merchandise.
  // A cautious source trim eliminates unused white space if possible, but
  // reverts to the untouched source when cropping is untrustworthy.
  const rotated = await sharp(input).rotate().toBuffer()
  const original = await sharp(rotated).metadata()
  let picture=rotated
  try {
    const trimmed = await sharp(rotated).trim({background:"#ffffff",threshold:12}).toBuffer()
    const measure=await sharp(trimmed).metadata()
    const originalArea=original.width*original.height
    const trimmedArea=measure.width*measure.height
    if(trimmedArea>originalArea*.09 && trimmedArea<originalArea*.91 &&
       measure.width>120 && measure.height>120) picture=trimmed
  } catch {
    picture=rotated
  }
  const size=570
  const normalized=await sharp(picture).resize(size,size,{
    fit:"contain",background:{r:255,g:251,b:247,alpha:1}
  }).ensureAlpha().png().toBuffer()
  // The photo itself is circularly feathered, so its source-square cannot
  // appear as another rectangular card in a 90px round category thumbnail.
  const mask=circularFade(size)
  return sharp(normalized)
    .composite([{input:mask,blend:"dest-in"}])
    .png().toBuffer()
}
async function circleArtwork(edit) {
  const product=ownedProduct(edit)
  const input=await exactProductPhoto(product)
  const photo=await containAndFeather(input)
  const art=await sharp(baseCircle(edit)).ensureAlpha()
    .composite([{input:photo,left:35,top:35}])
    .webp({quality:87,effort:5,alphaQuality:100}).toBuffer()
  if(art.length<6500 || art.length>600000) throw new Error(`Invalid artwork size ${edit.slug}: ${art.length}`)
  const meta=await sharp(art).metadata()
  if(meta.width!==WIDTH || meta.height!==WIDTH || meta.format!=="webp" || !meta.hasAlpha) throw new Error(`Not a real round WebP: ${edit.slug}`)
  // Verify rounded transparency and solid center before writing anywhere.
  const {data,info}=await sharp(art).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const alpha=(x,y)=>data[(y*info.width+x)*info.channels+3]
  if(alpha(0,0)>8 || alpha(639,0)>8 || alpha(0,639)>8 ||
     alpha(639,639)>8 || alpha(320,320)<250)
    throw new Error(`Artwork is not truly circle-masked: ${edit.slug}`)
  return art
}
async function hasObject(key){
  try{
    const o=await r2.send(new HeadObjectCommand({Bucket:bucket,Key:key}))
    return o.ContentType==="image/webp" && Number(o.ContentLength)>6500
  } catch(error){
    if(error?.$metadata?.httpStatusCode===404 || error?.name==="NotFound" || error?.name==="NoSuchKey") return false
    throw error
  }
}
await db.connect()
try{
  let completed=0
  for(const edit of EDITS){
    const key=`${PREFIX}${edit.slug}.webp`
    const url=`/api/catalog/image?key=${encodeURIComponent(key)}`
    const row=await db.query("SELECT image_url FROM home_category_media WHERE category_id=$1",[edit.id])
    if(row.rowCount!==1) throw new Error(`Missing home category ${edit.slug}`)
    if(row.rows[0].image_url===url){
      if(!await hasObject(key)) throw new Error(`Category asset missing from R2: ${edit.slug}`)
      completed++
      console.log(`Circle category already verified: ${edit.slug}`)
      continue
    }
    // Don't override an asset somebody has manually assigned. This only
    // replaces the earlier v2 generated squares the owner rejected.
    if(!row.rows[0].image_url.includes("category-v2%2F")){
      console.log(`Preserved custom category media: ${edit.slug}`)
      continue
    }
    if(!await hasObject(key)){
      const image=await circleArtwork(edit)
      await r2.send(new PutObjectCommand({
        Bucket:bucket,Key:key,ContentType:"image/webp",ContentLength:image.length,Body:image,
        CacheControl:"public,max-age=31536000,immutable"
      }))
      console.log(`Composed real circular product photo for ${edit.slug} from ${edit.sku}: ${image.length} bytes`)
    }
    if(!await hasObject(key)) throw new Error(`R2 upload verification failed for ${edit.slug}`)
    const result=await db.query(`UPDATE home_category_media SET
      image_url=$1,source_page=$2,photographer=$3,license_name=$4,
      width=640,height=640,updated_at=now()
      WHERE category_id=$5 AND image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v2%2F%'`,[
      url,`https://shopcelebration.in/jewelry/${encodeURIComponent(edit.sku)}`,
      `Celebration SKU: ${edit.sku}`,"Original Celebration product imagery",edit.id
    ])
    if(result.rowCount!==1) throw new Error(`Concurrent category edit detected: ${edit.slug}`)
    completed++
    console.log(`Replaced square with true circular image: ${edit.slug}`)
  }
  // Legacy v3 migration runs on *every* deploy. Once v4 successfully
  // replaced the round promo posters with source-photo crops, there are
  // intentionally zero current v3 rows. Upgraded v4 rows must count as
  // successful, not block future unrelated homepage releases.
  const count=await db.query("SELECT count(*)::int AS total FROM home_category_media WHERE image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v3%2F%' OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v4%2F%' OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v5%2F%' OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v6%2F%' OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v7%2F%'")
  if(count.rows[0]?.total!==7) throw new Error(`Only ${count.rows[0]?.total}/7 v3-or-newer category photos recorded`)
  console.log(`Circular Celebration category assets (v3 or upgraded v4) in R2/PostgreSQL: ${count.rows[0].total}/7, v3 newly processed ${completed}`)
} finally{
  await db.end()
  r2.destroy()
}
