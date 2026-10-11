#!/usr/bin/env node
/**
 * Release-time, once-only download of real editorial category photographs.
 * Provenance: Unsplash free-photo pages (not Plus or generated art).
 * This script does not modify customer product SKUs or catalog payloads.
 * Set env with @next/env loadEnvConfig before invoking; never log secrets.
 */
import pg from "pg"
import sharp from "sharp"
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const PHOTOS = [
  { id: "Premium Anti-Tarnish Necklaces", photo: "photo-1625792508553-5e66a81659fa", source: "https://unsplash.com/photos/gold-necklace-on-white-textile-QgK0yj6kc6k", by: "Mathilde Langevin", slug: "premium-necklaces" },
  { id: "Necklace + Earrings Sets", photo: "photo-1758995115857-2de1eb6283d0", source: "https://unsplash.com/photos/gold-necklace-and-earrings-displayed-on-white-stands-LA0edB8tqC0", by: "Zayed Ahmed Zadu", slug: "necklace-earring-sets" },
  { id: "Trending Necklaces", photo: "photo-1569397288884-4d43d6738fbd", source: "https://unsplash.com/photos/gold-colored-pendant-necklace-y2ErhoE92KA", by: "Alex Azabache", slug: "trending-necklaces" },
  { id: "Gold-Plated Bangles & Bracelets", photo: "photo-1758995119744-6454f091303f", source: "https://unsplash.com/photos/several-gold-bangles-displayed-on-a-stand-HQgfLYqIkBA", by: "Zayed Ahmed Zadu", slug: "bangles-bracelets" },
  { id: "Adjustable Rings", photo: "photo-1492714485642-dd6df6baafa2", source: "https://unsplash.com/photos/gold-colored-rings-BN0HcaBdPug", by: "Mel", slug: "adjustable-rings" },
  { id: "__all__", photo: "photo-1769116416641-e714b71851e8", source: "https://unsplash.com/photos/jewelry-box-filled-with-necklaces-rings-and-earrings-R5Cgy-aAIxc", by: "Nellie Adamyan", slug: "all-jewellery" },
  { id: "__hamper__", photo: "photo-1764385827352-78c20131fd47", source: "https://unsplash.com/photos/gift-box-with-ribbon-card-and-confetti-IsOQu4nML-Y", by: "Jess Bailey", slug: "custom-hampers" }
]

const required = ["DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
for (const name of required) if (!process.env[name]?.trim()) throw new Error(`Missing media migration environment: ${name}`)

const ssl = process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }
const pgClient = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl })
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
})
const bucket = process.env.R2_BUCKET
const keyFor = (item) => `catalog/editorial/category-v1/${item.slug}.webp`
const urlFor = (key) => `/api/catalog/image?key=${encodeURIComponent(key)}`

async function downloadAndOptimize(item) {
  const url = `https://images.unsplash.com/${item.photo}?auto=format&fit=crop&w=700&q=82`
  let error
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(25000),
        headers: { Accept: "image/jpeg,image/webp,image/png", "User-Agent": "Celebration-Category-Image-Migration/1.0" },
        cache: "no-store"
      })
      if (!response.ok) throw new Error(`PHOTO_HTTP_${response.status}`)
      const contentType = response.headers.get("content-type") || ""
      if (!/^image\/(jpeg|webp|png)(;|$)/i.test(contentType)) throw new Error("NOT_AN_IMAGE")
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 1000 || bytes.length > 8 * 1024 * 1024) throw new Error("PHOTO_SIZE_INVALID")
      const meta = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata()
      if (!meta.width || !meta.height || meta.width < 250 || meta.height < 250) throw new Error("PHOTO_RESOLUTION_INVALID")
      const optimized = await sharp(bytes).rotate().resize(352, 352, { fit: "cover", position: sharp.strategy.attention })
        .webp({ quality: 82, effort: 4 }).toBuffer()
      if (optimized.length > 400_000) throw new Error("OPTIMIZED_IMAGE_TOO_LARGE")
      return optimized
    } catch (cause) {
      error = cause
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)))
    }
  }
  throw new Error(`Could not fetch licensed category photo for ${item.slug}: ${String(error?.message || error)}`)
}

await pgClient.connect()
try {
  const table = await pgClient.query("SELECT to_regclass('public.home_category_media') AS name")
  if (!table.rows[0]?.name) throw new Error("Run migration 038 before seeding category photos")

  for (const item of PHOTOS) {
    const exists = await pgClient.query("SELECT image_url FROM home_category_media WHERE category_id = $1", [item.id])
    if (exists.rowCount) {
      console.log(`Category photography already recorded: ${item.slug}`)
      continue // Keep editor-managed overrides. Never overwrite existing database media.
    }

    const key = keyFor(item)
    let present = false
    try {
      const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      present = head.ContentType === "image/webp" && Number(head.ContentLength) > 1000
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound") throw error
    }

    if (!present) {
      const buffer = await downloadAndOptimize(item)
      await r2.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buffer, ContentType: "image/webp",
        ContentLength: buffer.length, CacheControl: "public,max-age=31536000,immutable"
      }))
      console.log(`Downloaded, WebP optimized and rehosted: ${item.slug} (${buffer.length} bytes)`)
    }
    const verify = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    if (verify.ContentType !== "image/webp" || Number(verify.ContentLength) < 1000) {
      throw new Error(`R2 asset verification failed: ${item.slug}`)
    }
    await pgClient.query(
      "INSERT INTO home_category_media (category_id,image_url,source_page,photographer,width,height) VALUES ($1,$2,$3,$4,352,352) ON CONFLICT (category_id) DO NOTHING",
      [item.id, urlFor(key), item.source, item.by]
    )
    console.log(`Stored category photograph in PostgreSQL: ${item.slug}`)
  }
  const count = await pgClient.query("SELECT count(*)::int AS n FROM home_category_media WHERE category_id = ANY($1::text[])", [PHOTOS.map((p) => p.id)])
  if (count.rows[0].n !== PHOTOS.length) throw new Error("Not all category images were committed")
  console.log(`Category media ready in R2 and PostgreSQL: ${count.rows[0].n}/${PHOTOS.length}`)
} finally {
  await pgClient.end()
  r2.destroy()
}
