#!/usr/bin/env node
/**
 * Customer-visible product-image smoke check, performed from the VPS.
 * This is read-only and checks the actual public route a customer requests,
 * not just the R2 object behind it. No product image substitutions.
 */
import { readFile } from "node:fs/promises"
import pg from "pg"

const SITE = "https://shopcelebration.in"
const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) throw new Error("DATABASE_URL is required for a live image verification")

const db = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }
})
await db.connect()
let products
try {
  const result = await db.query("SELECT payload FROM catalog_config WHERE id='primary'")
  if (!result.rows[0]) throw new Error("LIVE_CATALOG_NOT_FOUND")
  products = result.rows[0].payload.products || []
} finally {
  await db.end()
}

const failures = []
const images = []
const existing = new Set()
for (const product of products) {
  const hero = product.imageUrl
  if (!hero || existing.has(hero)) continue
  existing.add(hero)
  const url = new URL(hero, SITE)
  if (url.origin !== SITE || !["/api/catalog/image", "/catalog/necklaces"].some((prefix) => url.pathname.startsWith(prefix))) {
    failures.push(`${product.id}: UNEXPECTED_IMAGE_HOST`)
    continue
  }
  images.push({ id: product.id, url: url.href, webp: url.pathname.startsWith("/api/catalog/image") })
}

async function verify({ id, url, webp }) {
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error(`HTTP_${response.status}`)
    const type = response.headers.get("content-type") || ""
    if (!type.startsWith("image/")) throw new Error(`UNEXPECTED_CONTENT_TYPE:${type}`)
    const body = new Uint8Array(await response.arrayBuffer())
    if (body.length < 16) throw new Error("EMPTY_IMAGE")
    if (webp && !(body[0] === 82 && body[1] === 73 && body[2] === 70 && body[3] === 70 && body[8] === 87 && body[9] === 69 && body[10] === 66 && body[11] === 80)) {
      throw new Error("NOT_VALID_WEBP")
    }
    if (body.length > 12 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE")
    return null
  } catch (error) {
    return `${id}: ${error instanceof Error ? error.message : String(error)}`
  }
}

for (let i = 0; i < images.length; i += 4) {
  const results = await Promise.all(images.slice(i, i + 4).map(verify))
  failures.push(...results.filter(Boolean))
}
const optimized = images.filter(x => x.webp)
for (const size of ["thumb", "zoom"]) {
  // Spot-check all variants for one SKU in each product category.
  const sampleByCategory = new Map()
  for (const p of products) {
    if (sampleByCategory.has(p.category)) continue
    const hero = p.imageUrl
    if (!hero?.startsWith("/api/catalog/image?")) continue
    const url = new URL(hero, SITE)
    const key = url.searchParams.get("key") || ""
    if (!key.endsWith("/main.webp")) continue
    url.searchParams.set("key", key.replace(/\/main\.webp$/, `/${size}.webp`))
    sampleByCategory.set(p.category, { id: p.id + ":" + size, url: url.href, webp: true })
  }
  const results = await Promise.all([...sampleByCategory.values()].map(verify))
  failures.push(...results.filter(Boolean))
}
console.log(`Public catalog media: checked ${images.length} unique product hero URLs (${optimized.length} first-party WebP, ${images.length - optimized.length} legacy first-party assets), plus sampled thumb/zoom per R2 category. ${failures.length} errors.`)
if (failures.length) {
  for (const failure of failures) console.error("PUBLIC_IMAGE_FAILED:", failure)
  process.exitCode = 1
}
