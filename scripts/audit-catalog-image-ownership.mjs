#!/usr/bin/env node
/**
 * Four verification gates for Section 1 image ownership:
 * 1) SKU uniqueness and single-owner photos,
 * 2) source SHA -> R2 key must match the SAME seed SKU,
 * 3) images and hero image must preserve per-SKU provenance,
 * 4) real R2 main/thumb/zoom objects must exist before publishing.
 *
 * Default: read-only. --apply: ONLY fills trusted fallbackUrl fields on
 * existing R2 images, with a catalog-version-checked transaction.
 * Does not replace product photos, names, prices, stock or orders.
 */
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3"

const APPLY = process.argv.includes("--apply")
const seed = JSON.parse(await readFile(new URL("../content/catalog.json", import.meta.url), "utf8"))
const manifest = JSON.parse(await readFile(new URL("../content/catalog-image-source-map.json", import.meta.url), "utf8"))
const originalBySku = new Map(Object.entries(manifest.products || {}))
const originalOwner = new Map()
const owns = (url) => typeof url === "string" && /^https:\/\/upload\.meeshosupplyassets\.com\//.test(url)
const digest = (url) => createHash("sha256").update(url).digest("hex")
const mainKey = (url) => `catalog/rehost/meesho/${digest(url)}/main.webp`
function catalogR2Key(url) {
  if (typeof url !== "string" || !url.startsWith("/api/catalog/image?")) return null
  const p = new URLSearchParams(url.split("?")[1] || "")
  const key = p.get("key")
  return /^catalog\/rehost\/meesho\/[a-f0-9]{64}\/main\.webp$/.test(key || "") ? key : null
}
function allImages(product) {
  const urls = [product.imageUrl, ...(product.images || []).map((x) => x.url)]
  return [...new Set(urls.filter((x) => typeof x === "string" && x.trim()))]
}
function ownerIndex(products) {
  const byId = new Map()
  const byUrl = new Map()
  for (const item of products) {
    if (!item.id || byId.has(item.id)) throw new Error(`GATE_1_DUPLICATE_SKU:${item.id}`)
    byId.set(item.id, item)
    for (const url of allImages(item)) {
      if (byUrl.has(url) && byUrl.get(url) !== item.id) {
        throw new Error(`GATE_1_IMAGE_SHARED_BETWEEN_SKUS:${byUrl.get(url)}:${item.id}`)
      }
      byUrl.set(url, item.id)
    }
  }
  return { byId, byUrl }
}
const seedIndex = ownerIndex(seed.products || [])
for (const [id, entry] of originalBySku) {
  const seedProduct = seedIndex.byId.get(id)
  if (!seedProduct || !owns(entry.sourceUrl) || mainKey(entry.sourceUrl) !== entry.mainKey ||
      !allImages(seedProduct).includes(`/api/catalog/image?key=${encodeURIComponent(entry.mainKey)}`) ||
      !seedProduct.images?.some((img) => img.url === `/api/catalog/image?key=${encodeURIComponent(entry.mainKey)}` && img.fallbackUrl === entry.sourceUrl)) {
    throw new Error(`GATE_1_MANIFEST_SKU_PROVENANCE_INVALID:${id}`)
  }
  if (originalOwner.has(entry.sourceUrl) && originalOwner.get(entry.sourceUrl) !== id) throw new Error("GATE_1_SHARED_ORIGINAL_SOURCE")
  originalOwner.set(entry.sourceUrl, id)
}
console.log(`Gate 1/4: seed has ${seedIndex.byId.size} unique SKUs, no cross-SKU image reuse.`)

const dbUrl = process.env.DATABASE_URL?.trim()
if (!dbUrl) {
  if (APPLY) throw new Error("DATABASE_URL required to apply.")
  console.log("No DB configured: source-only gate complete; live gates pending.")
  process.exit(0)
}
const database = new pg.Client({
  connectionString: dbUrl,
  ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }
})
await database.connect()
try {
  const [live, draft] = await Promise.all([
    database.query("SELECT payload,version FROM catalog_config WHERE id='primary'"),
    database.query("SELECT payload,base_version,updated_at FROM catalog_drafts WHERE id='primary'")
  ])
  const liveRow = live.rows[0]
  const draftRow = draft.rows[0] || null
  if (!liveRow) throw new Error("LIVE_CATALOG_MISSING")
  const payloads = [{ label: "live", payload: liveRow.payload }, ...(draftRow ? [{ label: "draft", payload: draftRow.payload }] : [])]
  const neededSources = new Set()
  let known = 0, unresolved = 0, legacy = 0
  // Gates 1-3: verify mappings without inferring relationships from name alone.
  for (const { label, payload } of payloads) {
    const existingIndex = ownerIndex(payload.products || [])
    console.log(`Gate 1/4: ${label} ${existingIndex.byId.size} unique SKUs, no image URL shared by different SKUs.`)
    for (const product of payload.products || []) {
      const expected = originalBySku.get(product.id)
      for (const url of allImages(product)) {
        const key = catalogR2Key(url)
        if (!key) {
          if (owns(url)) legacy++
          continue
        }
        // Gate 2: the R2 photo must hash to an ORIGINAL image for THIS SKU.
        const source = expected?.sourceUrl && mainKey(expected.sourceUrl) === key ? expected.sourceUrl : null
        if (!source) {
          throw new Error(`GATE_2_SOURCE_SKU_MISMATCH:${label}:${product.id}`)
        }
        if (originalOwner.get(source) !== product.id) {
          throw new Error(`GATE_2_SOURCE_OWNERSHIP_MISMATCH:${label}:${product.id}`)
        }
        neededSources.add(source)
        known++
      }
      // Gate 3: hero, gallery and any existing fallback must be consistent.
      const gallery = product.images || []
      if (gallery.length && product.imageUrl && gallery[0].url !== product.imageUrl) {
        throw new Error(`GATE_3_HERO_GALLERY_MISMATCH:${label}:${product.id}`)
      }
      for (const image of gallery) {
        if (!image.fallbackUrl) continue
        const key = catalogR2Key(image.url)
        if (!key || !owns(image.fallbackUrl) || mainKey(image.fallbackUrl) !== key ||
            originalOwner.get(image.fallbackUrl) !== product.id) {
          throw new Error(`GATE_3_INVALID_FALLBACK:${label}:${product.id}`)
        }
      }
    }
  }
  console.log(`Gate 2/4: ${known} rehosted images match their original source SHA and exact SKU. ${legacy} external source references remain.`)
  console.log("Gate 3/4: hero-gallery alignment and existing per-image fallbacks validated.")

  // Gate 4: validate every R2 object and size variant, not simply the URL text.
  if (neededSources.size) {
    for (const v of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      if (!process.env[v]) throw new Error(`GATE_4_MISSING_R2_ENV:${v}`)
    }
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
    })
    const photoHashes = new Map()
    for (const source of neededSources) {
      const base = mainKey(source).replace(/main\.webp$/, "")
      for (const size of ["thumb", "main", "zoom"]) {
        const head = await s3.send(new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET, Key: `${base}${size}.webp`
        }))
        if (head.ContentType !== "image/webp" || !Number(head.ContentLength)) {
          throw new Error(`GATE_4_BAD_R2_ASSET:${size}:${digest(source)}`)
        }
      }
      // Detect identical bytes under two unrelated SKU image URLs.
      const body = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: mainKey(source) }))
      if (!body.Body) throw new Error("GATE_4_EMPTY_IMAGE")
      const bytes = await body.Body.transformToByteArray()
      const fileHash = createHash("sha256").update(bytes).digest("hex")
      const owner = originalOwner.get(source)
      const previous = photoHashes.get(fileHash)
      if (previous && previous !== owner) throw new Error(`GATE_4_DUPLICATE_PHOTO_BETWEEN_SKUS:${previous}:${owner}`)
      photoHashes.set(fileHash, owner)
    }
  }
  console.log(`Gate 4/4: ${neededSources.size * 3} R2 WebP variants HEAD-verified for the correct SHA source. All 4 gates passed.`)

  if (!APPLY) {
    console.log("DRY RUN: no catalog changes made.")
  } else {
    // Assign ONLY a proven original source to its already-rehosted image.
    const withFallback = (payload) => {
      const next = structuredClone(payload)
      let added = 0
      for (const product of next.products || []) {
        const seedPhoto = originalBySku.get(product.id)
        if (!seedPhoto) continue
        const fallbackFor = (url) => {
          const key = catalogR2Key(url)
          if (!key) return undefined
          return seedPhoto && mainKey(seedPhoto.sourceUrl) === key && originalOwner.get(seedPhoto.sourceUrl) === product.id ? seedPhoto.sourceUrl : undefined
        }
        const hero = product.imageUrl
        if (!product.images?.length && fallbackFor(hero)) {
          product.images = [{ url: hero, alt: product.name, fallbackUrl: fallbackFor(hero) }]
          added++
        }
        for (const image of product.images || []) {
          const original = fallbackFor(image.url)
          if (original && image.fallbackUrl !== original) {
            image.fallbackUrl = original
            added++
          }
        }
      }
      return { next, added }
    }
    await database.query("BEGIN")
    try {
      const current = (await database.query("SELECT payload,version FROM catalog_config WHERE id='primary' FOR UPDATE")).rows[0]
      if (!current || current.version !== liveRow.version) throw new Error("CATALOG_CONCURRENT_EDIT")
      const currentDraft = (await database.query("SELECT payload,base_version,updated_at FROM catalog_drafts WHERE id='primary' FOR UPDATE")).rows[0] || null
      if (Boolean(currentDraft) !== Boolean(draftRow) ||
          (draftRow && (draftRow.base_version !== currentDraft.base_version || String(draftRow.updated_at) !== String(currentDraft.updated_at)))) {
        throw new Error("DRAFT_CONCURRENT_EDIT")
      }
      const l = withFallback(current.payload)
      const d = currentDraft ? withFallback(currentDraft.payload) : null
      if (l.added > 0) {
        const saved = await database.query(
          "UPDATE catalog_config SET payload=$1::jsonb,version=version+1,updated_at=now() WHERE id='primary' RETURNING version",
          [JSON.stringify(l.next)]
        )
        await database.query("INSERT INTO catalog_revisions(version,payload) VALUES($1,$2::jsonb)", [saved.rows[0].version, JSON.stringify(l.next)])
        if (d) await database.query("UPDATE catalog_drafts SET payload=$1::jsonb,base_version=$2,updated_at=now() WHERE id='primary'", [JSON.stringify(d.next), saved.rows[0].version])
      } else if (d?.added > 0) {
        await database.query("UPDATE catalog_drafts SET payload=$1::jsonb,updated_at=now() WHERE id='primary'", [JSON.stringify(d.next)])
      }
      await database.query("COMMIT")
      console.log(`APPLIED: added or repaired fallback metadata for ${l.added} live images and ${d?.added || 0} draft images. Original main image URLs unchanged.`)
    } catch (error) {
      await database.query("ROLLBACK")
      throw error
    }
  }
} finally { await database.end() }
