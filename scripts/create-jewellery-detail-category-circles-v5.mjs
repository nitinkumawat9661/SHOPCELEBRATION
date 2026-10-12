#!/usr/bin/env node
/**
 * Actual photographic category crops — not a miniature Meesho/marketing poster.
 *
 * v3 simply masked a WHOLE promotional poster into a circle. The model, slogans,
 * brand logo, warranty labels and tiny feature icons all remained visible.
 * v5 extracts the REAL product/model photographic region first,
 * then composes that untouched source geometry into a circular image.
 * No AI reconstruction, jewelry alterations, fake product or source replacement.
 *
 * These tighter focus regions are based on the product positions in the owner's screenshot; do not claim final device-level verification.
 * R2 and SQL are updated only if all assets can be created and verified.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import pg from "pg"
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..")
const raw=JSON.parse(await readFile(path.join(root,"content/catalog.json"),"utf8"))
const products=new Map(raw.products.map(p=>[p.id,p]))
const size=640
const prefix="catalog/editorial/category-v5/"
// Tight, product-focused real-image regions. Previous v4 regions were too
// large (53-56% width) and still included the Celebration marketing poster's
// logo, slogans and feature rows. Each v5 frame covers only a 30-35% area
// centered on visible original merchandise, not a promotional layout.
const items=[
  {id:"Premium Anti-Tarnish Necklaces",slug:"premium-necklaces",sku:"celebration-necklace-002",roi:[.54,.36,.32,.36],tint:"#f2ded8"},
  {id:"Necklace + Earrings Sets",slug:"necklace-earring-sets",sku:"celebration-set-002",roi:[.59,.37,.32,.36],tint:"#f0dde4"},
  {id:"Trending Necklaces",slug:"trending-necklaces",sku:"celebration-necklace-025",roi:[.62,.45,.33,.34],tint:"#efe1e7"},
  {id:"Gold-Plated Bangles & Bracelets",slug:"bangles-bracelets",sku:"celebration-bangle-002",roi:[.62,.34,.33,.39],tint:"#efe1cf"},
  {id:"Adjustable Rings",slug:"adjustable-rings",sku:"celebration-ring-001",roi:[.36,.34,.34,.36],tint:"#f0e2db"},
  {id:"__all__",slug:"all-jewellery",sku:"celebration-set-005",roi:[.53,.39,.34,.35],tint:"#eadcda"},
  {id:"__hamper__",slug:"custom-hampers",sku:"celebration-necklace-003",roi:[.51,.35,.35,.38],tint:"#f3dfe4"}
]
for(const name of ["DATABASE_URL","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"]){
  if(!process.env[name]?.trim()) throw new Error(`Missing category media configuration ${name}`)
}
const r2=new S3Client({region:"auto",endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{
  accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY
}})
const bucket=process.env.R2_BUCKET
const db=new pg.Client({connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL_MODE==="disable"?false:{rejectUnauthorized:true}})

function choose(item){
  const p=products.get(item.sku)
  if(!p || p.active===false || !p.imageUrl || (!item.id.startsWith("__")&&p.category!==item.id))
    throw new Error(`Category/photo ownership mismatch: ${item.slug}`)
  const [x,y,w,h]=item.roi
  if(![x,y,w,h].every(n=>Number.isFinite(n)&&n>=0&&n<=1) ||
    w<.29 || w>.35 || h<.32 || h>.40 || x+w>1 || y+h>1)
    throw new Error(`Unsafe or unreviewed image crop: ${item.slug}`)
  return p
}
for(const item of items)choose(item)

async function originalBytes(p){
  const src=p.imageUrl
  let data
  if(src.startsWith("/api/catalog/image?key=")){
    const key=new URL(src,"https://shopcelebration.in").searchParams.get("key")||""
    if(!/^catalog\/rehost\/meesho\/[a-f0-9]{64}\/main\.webp$/.test(key))
      throw new Error(`Unknown R2 product source for ${p.id}`)
    const o=await r2.send(new GetObjectCommand({Bucket:bucket,Key:key}))
    if(!o.Body)throw new Error(`Missing original image ${p.id}`)
    data=Buffer.from(await o.Body.transformToByteArray())
  }else{
    const url=new URL(src)
    if(url.protocol!=="https:"||url.hostname!=="shopcelebration.in"||
      !/^\/catalog\/necklaces\/celebration-necklace-\d{3}\.png$/.test(url.pathname)||
      url.search||url.hash)throw new Error(`Unexpected original file path ${p.id}`)
    data=await readFile(path.join(root,"public",url.pathname.slice(1)))
  }
  if(data.length<1000 ||data.length>14_000_000)throw new Error(`Invalid SKU image bytes ${p.id}`)
  return data
}
function circleSvg(tint){
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <defs><radialGradient id="g" cx=".42" cy=".32" r=".76">
      <stop offset="0" stop-color="#fffdfb"/>
      <stop offset=".8" stop-color="${tint}"/>
      <stop offset="1" stop-color="#d5bdb5"/>
    </radialGradient></defs>
    <circle cx="320" cy="320" r="315" fill="url(#g)"/>
  </svg>`)
}
function roundMask(){
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs><radialGradient id="m" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="white"/>
      <stop offset=".83" stop-color="white"/>
      <stop offset=".99" stop-color="white" stop-opacity=".02"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="300" cy="300" r="300" fill="url(#m)"/>
  </svg>`)
}
async function compose(item){
  const p=choose(item)
  const rawPhoto=await originalBytes(p)
  const meta=await sharp(rawPhoto,{limitInputPixels:24_000_000}).metadata()
  if(!meta.width||!meta.height||meta.width<300||meta.height<300)
    throw new Error(`Photograph too small for careful crop: ${p.id}`)
  const [x,y,w,h]=item.roi
  const left=Math.round(meta.width*x),top=Math.round(meta.height*y)
  const width=Math.min(meta.width-left,Math.round(meta.width*w))
  const height=Math.min(meta.height-top,Math.round(meta.height*h))
  if(width<120||height<120)throw new Error(`Cropped merchandise region too small: ${item.slug}`)
  // Strictly a region from the same PHOTO — the poster header/footer is left
  // out. No AI inpainting or re-drawing of necklace/ring/bangle geometry.
  const focused=await sharp(rawPhoto).rotate().extract({left,top,width,height})
    .resize(600,600,{fit:"cover",position:"centre"}).ensureAlpha().png().toBuffer()
  const masked=await sharp(focused)
    .composite([{input:roundMask(),blend:"dest-in"}]).png().toBuffer()
  const art=await sharp(circleSvg(item.tint)).ensureAlpha()
    .composite([{input:masked,left:20,top:20}])
    .webp({quality:86,effort:5,alphaQuality:100}).toBuffer()
  const check=await sharp(art).metadata()
  if(art.length<6500||art.length>650_000||check.width!==size||check.height!==size||
    check.format!=="webp"||!check.hasAlpha)throw new Error(`Malformed photo circle for ${item.slug}`)
  const {data,info}=await sharp(art).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const alpha=(x,y)=>data[(y*info.width+x)*info.channels+3]
  if(alpha(0,0)>8||alpha(639,639)>8||alpha(320,320)<245)
    throw new Error(`Circle alpha mask failed for ${item.slug}`)
  return art
}
async function verified(key){
  try{
    const h=await r2.send(new HeadObjectCommand({Bucket:bucket,Key:key}))
    return h.ContentType==="image/webp"&&Number(h.ContentLength)>6500
  }catch(err){
    if(err?.$metadata?.httpStatusCode===404||err?.name==="NotFound"||err?.name==="NoSuchKey")return false
    throw err
  }
}
await db.connect()
try{
  // Stage ALL objects first. Never publish partial category replacements.
  const staged=[]
  for(const item of items){
    const key=`${prefix}${item.slug}.webp`
    const row=await db.query("SELECT image_url FROM home_category_media WHERE category_id=$1",[item.id])
    if(row.rowCount!==1)throw new Error(`Category row missing: ${item.slug}`)
    const old=row.rows[0].image_url
    const url=`/api/catalog/image?key=${encodeURIComponent(key)}`
    if(old.includes("category-v6%2F") || old.includes("category-v7%2F")) { console.log(`Owner-approved v6 media preserved: ${item.slug}`); continue }
    if(old!==url&&!old.includes("category-v4%2F"))
      throw new Error(`Owner-edited category image protected: ${item.slug}`)
    if(!await verified(key)){
      const bytes=await compose(item)
      await r2.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,
        ContentType:"image/webp",ContentLength:bytes.length,
        CacheControl:"public,max-age=31536000,immutable"}))
      console.log(`Cropping actual merchandise region of ${item.sku}: ${item.slug}, ${bytes.length} bytes`)
    }
    if(!await verified(key))throw new Error(`R2 verify failed: ${item.slug}`)
    staged.push({item,key,url,old})
  }
  await db.query("BEGIN")
  try{
    for(const {item,url,old}of staged){
      const result=await db.query(`UPDATE home_category_media SET
        image_url=$1,source_page=$2,photographer=$3,license_name=$4,
        width=640,height=640,updated_at=now()
        WHERE category_id=$5 AND image_url=$6`,[
          url,`https://shopcelebration.in/jewelry/${encodeURIComponent(item.sku)}`,
          `Celebration exact source SKU: ${item.sku}`,
          "Cropped original Celebration product photograph",item.id,old
        ])
      if(result.rowCount!==1)throw new Error(`Category changed during publish: ${item.slug}`)
    }
    await db.query("COMMIT")
  }catch(error){
    await db.query("ROLLBACK")
    throw error
  }
  console.log(`Zoomed jewellery-only category circles installed: ${staged.length}/7`)
}finally{
  await db.end()
  r2.destroy()
}
