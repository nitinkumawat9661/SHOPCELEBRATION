#!/usr/bin/env node
/**
 * Celebration-owned category art, composed only from verified catalog SKU photos.
 * No image model is allowed to invent or alter jewelry geometry. Use Sharp to
 * art-direct the ORIGINAL product photographs into subtle editorial layouts.
 * Generated 640px WebP files live in R2, with SKU source in PostgreSQL.
 *
 * Safe to run on every release: versioned object names, source validation,
 * no product writes, skip customized category photos, and update DB only after
 * all object uploads/HEAD checks succeed.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import pg from "pg"
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const catalog = JSON.parse(await readFile(path.join(root, "content/catalog.json"), "utf8"))
const byId = new Map(catalog.products.map((item) => [item.id, item]))
const SIZE = 640
const PREFIX = "catalog/editorial/category-v2/"
const THEMES = {
  cream: ["#fffaf4", "#f0ded5", "#cfafa3"],
  blush: ["#fffaf7", "#f2dfe0", "#d6a9aa"],
  sand: ["#fff9ef", "#f1e4d0", "#cbb298"],
  lavender: ["#faf7f9", "#e8e0e9", "#c8acc0"],
  pearl: ["#fbfbf8", "#e8e4dc", "#c9bcb1"],
  mint: ["#f9faf5", "#e3e9dc", "#b1c9bf"],
  rose: ["#fffaf8", "#eaddda", "#cfb3a8"]
}
const EDITS = [
  { id: "Premium Anti-Tarnish Necklaces", slug: "premium-necklaces", a: "celebration-necklace-002", b: "celebration-necklace-004", theme: "cream" },
  { id: "Necklace + Earrings Sets", slug: "necklace-earring-sets", a: "celebration-set-002", b: "celebration-set-005", theme: "blush" },
  { id: "Trending Necklaces", slug: "trending-necklaces", a: "celebration-necklace-025", b: "celebration-necklace-026", theme: "lavender" },
  { id: "Gold-Plated Bangles & Bracelets", slug: "bangles-bracelets", a: "celebration-bangle-002", b: "celebration-bangle-009", theme: "sand" },
  { id: "Adjustable Rings", slug: "adjustable-rings", a: "celebration-ring-002", b: "celebration-ring-005", theme: "pearl" },
  { id: "__all__", slug: "all-jewellery", a: "celebration-set-005", b: "celebration-bangle-002", theme: "mint" },
  { id: "__hamper__", slug: "custom-hampers", a: "celebration-necklace-003", b: "celebration-ring-003", theme: "rose" }
]
const P = (value) => String(value || "").trim()
for (const variable of ["DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
  if (!P(process.env[variable])) throw new Error(`Missing required image generation config: ${variable}`)
}
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
})
const bucket = process.env.R2_BUCKET
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }
})
function sku(id) {
  const product = byId.get(id)
  if (!product || product.active === false) throw new Error(`Invalid or inactive source SKU: ${id}`)
  return product
}
function validateMappings() {
  for (const edit of EDITS) {
    const a = sku(edit.a), b = sku(edit.b)
    if (!EDIT_KEYS.has(edit.id)) throw new Error(`Unknown category ${edit.id}`)
    if (!edit.id.startsWith("__") && (a.category !== edit.id || b.category !== edit.id)) {
      throw new Error(`Cross-category or mismatched product photo: ${edit.id}`)
    }
    if (!a.imageUrl || !b.imageUrl || a.id === b.id) throw new Error(`Missing or reused SKU media: ${edit.id}`)
  }
}
const EDIT_KEYS = new Set([...new Set(catalog.products.map((p) => p.category)), "__all__", "__hamper__"])
validateMappings()

async function loadExactSKUPhoto(product) {
  const photo = product.imageUrl
  let bytes
  if (photo.startsWith("/api/catalog/image?key=")) {
    const key = new URL(photo, "https://shopcelebration.in").searchParams.get("key") || ""
    if (!/^catalog\/rehost\/meesho\/[a-f0-9]{64}\/main\.webp$/.test(key)) {
      throw new Error(`Unexpected photo key for ${product.id}`)
    }
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!object.Body) throw new Error(`Missing R2 source image for ${product.id}`)
    bytes = Buffer.from(await object.Body.transformToByteArray())
  } else {
    // Original 22 first-party PNG photos are in this repository's /public/catalog directory.
    const parsed = new URL(photo)
    if (parsed.protocol !== "https:" || parsed.hostname !== "shopcelebration.in" ||
        !/^\/catalog\/necklaces\/celebration-necklace-\d{3}\.png$/.test(parsed.pathname) ||
        parsed.search || parsed.hash) throw new Error(`Unsafe local photo for ${product.id}`)
    bytes = await readFile(path.join(root, "public", parsed.pathname.slice(1)))
  }
  if (bytes.length < 1000 || bytes.length > 14 * 1024 * 1024) throw new Error(`Source image size invalid for ${product.id}`)
  const meta = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata()
  if (!meta.width || !meta.height || meta.width < 220 || meta.height < 220) {
    throw new Error(`Not a valid merchandise photograph for ${product.id}`)
  }
  return bytes
}
function matteSvg(w, h, radius = 42) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${radius}" fill="white"/>
  </svg>`)
}
async function photoPanel(bytes, w, h, radius) {
  // Contain, don't distort jewelry or crop information embedded in source media.
  const image = await sharp(bytes, { limitInputPixels: 24_000_000 })
    .rotate().resize(w, h, { fit: "contain", background: "#fffdf9" })
    .png().toBuffer()
  return sharp(image).composite([{ input: matteSvg(w, h, radius), blend: "dest-in" }]).png().toBuffer()
}
function background(edit) {
  const [paper, tint, foil] = THEMES[edit.theme]
  const pale = edit.id === "__hamper__" ? "#8e5365" : "#9b7981"
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <defs>
      <radialGradient id="paper" cx="27%" cy="18%" r="90%">
        <stop offset="0" stop-color="${paper}"/>
        <stop offset=".67" stop-color="${tint}"/>
        <stop offset="1" stop-color="${foil}"/>
      </radialGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>
        <stop offset=".85" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="640" height="640" fill="url(#paper)"/>
    <circle cx="130" cy="58" r="275" fill="#ffffff" opacity=".28"/>
    <circle cx="615" cy="540" r="270" fill="${pale}" opacity=".07"/>
    <circle cx="320" cy="320" r="286" fill="none" stroke="#ffffff" stroke-width="2" opacity=".67"/>
    <path d="M0 140 Q320 60 640 132 M0 570 Q310 622 640 545" stroke="#ffffff" stroke-width="2" fill="none" opacity=".24"/>
    <rect width="640" height="640" fill="url(#sheen)"/>
    <rect x="51" y="51" width="524" height="524" rx="60" fill="#604454" opacity=".10"/>
    <rect x="49" y="44" width="524" height="524" rx="60" fill="#fffefb" opacity=".85"/>
    <rect x="383" y="400" width="188" height="188" rx="30" fill="#674353" opacity=".13"/>
    <rect x="381" y="394" width="188" height="188" rx="30" fill="#fffdf9"/>
  </svg>`)
}
async function compose(edit) {
  const main = await loadExactSKUPhoto(sku(edit.a))
  const detail = await loadExactSKUPhoto(sku(edit.b))
  const [large, small] = await Promise.all([photoPanel(main, 504, 504, 52), photoPanel(detail, 176, 176, 25)])
  const productArt = await sharp(background(edit)).composite([
    { input: large, left: 59, top: 54 },
    { input: small, left: 387, top: 400 }
  ]).webp({ quality: 85, effort: 5 }).toBuffer()
  if (productArt.length < 7000 || productArt.length > 650_000) {
    throw new Error(`Generated art size invalid for ${edit.id}: ${productArt.length} bytes`)
  }
  const meta = await sharp(productArt).metadata()
  if (meta.width !== SIZE || meta.height !== SIZE || meta.format !== "webp") throw new Error("Art dimension mismatch")
  return productArt
}
async function alreadyUploaded(key) {
  try {
    const obj = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return obj.ContentType === "image/webp" && Number(obj.ContentLength) >= 7000
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || err?.name === "NoSuchKey") return false
    throw err
  }
}
async function run() {
  await db.connect()
  const completed = []
  try {
    for (const edit of EDITS) {
      const key = `${PREFIX}${edit.slug}.webp`
      const page = `https://shopcelebration.in/jewelry/${encodeURIComponent(edit.a)}`
      const url = `/api/catalog/image?key=${encodeURIComponent(key)}`
      const row = await db.query("SELECT image_url FROM home_category_media WHERE category_id = $1", [edit.id])
      if (!row.rowCount) throw new Error(`Missing persisted category (migration 038): ${edit.id}`)
      if (row.rows[0].image_url === url) {
        if (!await alreadyUploaded(key)) throw new Error(`Published asset missing: ${edit.slug}`)
        console.log(`Celebration category photo already installed: ${edit.slug}`)
        completed.push(edit.slug)
        continue
      }
      // The owner may override thumbnails in future. Never overwrite those.
      if (!row.rows[0].image_url.includes("category-v1%2F")) {
        console.log(`Owner-managed category art kept: ${edit.slug}`)
        continue
      }
      if (!await alreadyUploaded(key)) {
        const bytes = await compose(edit)
        await r2.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: bytes, ContentLength: bytes.length,
          ContentType: "image/webp", CacheControl: "public,max-age=31536000,immutable"
        }))
        console.log(`Created from Celebration SKUs ${edit.a} + ${edit.b}: ${edit.slug} (${bytes.length} B)`)
      }
      if (!await alreadyUploaded(key)) throw new Error(`R2 verification failed: ${edit.slug}`)
      // Source ownership stays traceable to the exact primary SKU, without changing the SKU gallery.
      await db.query(`UPDATE home_category_media
        SET image_url=$1, source_page=$2, photographer=$3, license_name=$4,
            width=$5, height=$5, updated_at=now()
        WHERE category_id=$6 AND image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v1%2F%'`,
        [url, page, `Celebration catalog: ${edit.a} + ${edit.b}`, "Original Celebration merchandise photos", SIZE, edit.id]
      )
      completed.push(edit.slug)
      console.log(`Category R2/SQL upgraded to authentic product photography: ${edit.slug}`)
    }
    const n = await db.query(
      "SELECT count(*)::int AS n FROM home_category_media WHERE image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v2%2F%'"
    )
    console.log(`Celebration real product category media v2: ${n.rows[0].n}/7, processed ${completed.length}/7`)
  } finally {
    await db.end()
    r2.destroy()
  }
}
await run()
