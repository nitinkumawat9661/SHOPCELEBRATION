#!/usr/bin/env node
/**
 * Rehost *existing* Meesho catalog images in Celebration R2.
 * --dry-run (default): inventory only; --apply: download, WebP-optimize,
 * verify all R2 variants, then atomically replace matching live CMS URLs.
 * No Shipway, order, payment, price or stock writes.
 *
 * Production: load .env.production via @next/env before executing this file.
 */
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"
import sharp from "sharp"
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const APPLY = process.argv.includes("--apply")
const HOST = "upload.meeshosupplyassets.com"
const BUCKET_PREFIX = "catalog/rehost/meesho"
const MAX_BYTES = 12 * 1024 * 1024
const WEBP = { thumb: 360, main: 900, zoom: 1600 }
const isMeesho = (value) => {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === HOST && url.port === "" && !url.username && !url.password
  } catch { return false }
}
const keyBase = (source) => `${BUCKET_PREFIX}/${createHash("sha256").update(source).digest("hex")}`
const keyFor = (source, size) => `${keyBase(source)}/${size}.webp`
const ownUrl = (source) => `/api/catalog/image?key=${encodeURIComponent(keyFor(source, "main"))}`

function scan(payload) {
  const used = new Set()
  for (const product of payload?.products || []) {
    if (isMeesho(product?.imageUrl)) used.add(product.imageUrl)
    for (const image of product?.images || []) if (isMeesho(image?.url)) used.add(image.url)
  }
  return used
}

function replaceCatalog(payload, replacements) {
  const next = structuredClone(payload)
  let changed = 0
  for (const product of next.products || []) {
    if (replacements.has(product.imageUrl)) {
      product.imageUrl = replacements.get(product.imageUrl)
      changed++
    }
    for (const image of product.images || []) {
      if (replacements.has(image.url)) {
        image.url = replacements.get(image.url)
        changed++
      }
    }
  }
  return { payload: next, changed }
}

async function imageData(url) {
  // No redirects: prohibit downloading third-party redirect destinations.
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET", redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: { "Accept": "image/jpeg,image/png,image/webp,image/*;q=0.8", "User-Agent": "CelebrationCatalogMigration/1.0" },
        cache: "no-store"
      })
      if (!response.ok) throw new Error(`HTTP_${response.status}`)
      const length = Number(response.headers.get("content-length") || 0)
      if (length > MAX_BYTES) throw new Error("SOURCE_TOO_LARGE")
      const type = response.headers.get("content-type") || ""
      if (!type.startsWith("image/")) throw new Error("NOT_IMAGE")
      const reader = response.body?.getReader()
      if (!reader) throw new Error("EMPTY_BODY")
      const parts = []
      let bytes = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.length
          if (bytes > MAX_BYTES) throw new Error("SOURCE_TOO_LARGE")
          parts.push(value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      if (!bytes) throw new Error("EMPTY_BODY")
      return Buffer.concat(parts, bytes)
    } catch (error) {
      lastError = error
      if (attempt !== 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

function r2Client() {
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (!process.env[name]) throw new Error(`Missing production setting: ${name}`)
  }
  return new S3Client({
    region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
  })
}

async function exists(s3, key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
    return head.ContentType === "image/webp" && Number(head.ContentLength) > 0
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return false
    throw error
  }
}

async function uploadVariants(s3, source) {
  const missing = []
  for (const size of Object.keys(WEBP)) if (!(await exists(s3, keyFor(source, size)))) missing.push(size)
  if (!missing.length) return
  const data = await imageData(source)
  const probe = await sharp(data, { limitInputPixels: 60000000 }).metadata()
  if (!["jpeg", "png", "webp", "avif"].includes(probe.format) || !probe.width || !probe.height) {
    throw new Error("UNSUPPORTED_IMAGE_FORMAT")
  }
  for (const size of missing) {
    const rendered = await sharp(data, { limitInputPixels: 60000000 })
      .rotate().resize({ width: WEBP[size], height: WEBP[size], fit: "inside", withoutEnlargement: true })
      .webp({ quality: size === "thumb" ? 77 : 83, effort: 4 }).toBuffer()
    if (!rendered.length || rendered.length > MAX_BYTES) throw new Error("WEBP_RENDER_FAILED")
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET, Key: keyFor(source, size),
      Body: rendered, ContentType: "image/webp", ContentLength: rendered.length,
      CacheControl: "public, max-age=31536000, immutable"
    }))
  }
  for (const size of Object.keys(WEBP)) {
    if (!(await exists(s3, keyFor(source, size)))) throw new Error("R2_VERIFICATION_FAILED")
  }
}

const seed = JSON.parse(await readFile(new URL("../content/catalog.json", import.meta.url), "utf8"))
const seedUrls = scan(seed)
console.log(`Bootstrap: ${seed.products?.length || 0} products, ${seedUrls.size} unique Meesho image sources.`)
const dbUrl = process.env.DATABASE_URL?.trim()
if (!dbUrl) {
  if (APPLY) throw new Error("DATABASE_URL required for --apply")
  console.log("DATABASE_URL not supplied: bootstrap-only scan.")
  process.exit(0)
}
const database = new pg.Client({
  connectionString: dbUrl,
  ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }
})
await database.connect()
try {
  const live = (await database.query("SELECT version,payload FROM catalog_config WHERE id='primary'")).rows[0]
  if (!live) throw new Error("LIVE_CATALOG_MISSING")
  const draft = (await database.query("SELECT payload,base_version,updated_at FROM catalog_drafts WHERE id='primary'")).rows[0] || null
  const sources = new Set([...scan(live.payload), ...(draft ? scan(draft.payload) : [])])
  console.log(`Live: ${live.payload.products?.length || 0} products, ${scan(live.payload).size} remote sources. Draft: ${draft ? scan(draft.payload).size : 0}. Unique sources to rehost: ${sources.size}.`)
  if (!APPLY) {
    console.log("DRY RUN only. No downloads, cloud writes or database changes.")
  } else if (!sources.size) {
    console.log("Already migrated: no Meesho-hosted live/draft images remain.")
  } else {
    const s3 = r2Client()
    const replacements = new Map()
    const failures = []
    let completed = 0
    for (const source of sources) {
      try {
        await uploadVariants(s3, source)
        replacements.set(source, ownUrl(source))
        completed++
        console.log(`Verified ${completed}/${sources.size}: ${keyBase(source)}`)
      } catch (error) {
        failures.push({ url: source, error: error?.message || String(error) })
        console.error(`Image unavailable: ${source} (${error?.message || error})`)
      }
    }
    if (failures.length) throw new Error(`Aborted without catalog changes: ${failures.length}/${sources.size} image sources failed. Do not switch to URLs until every object is verified.`)
    await database.query("BEGIN")
    try {
      const locked = (await database.query("SELECT version,payload FROM catalog_config WHERE id='primary' FOR UPDATE")).rows[0]
      if (locked.version !== live.version) throw new Error("CATALOG_CHANGED_DURING_DOWNLOAD")
      const latestDraft = (await database.query("SELECT payload,base_version,updated_at FROM catalog_drafts WHERE id='primary' FOR UPDATE")).rows[0] || null
      if (Boolean(latestDraft) !== Boolean(draft) ||
        (draft && (latestDraft?.base_version !== draft.base_version || String(latestDraft?.updated_at) !== String(draft.updated_at)))) {
        throw new Error("CATALOG_DRAFT_CHANGED_DURING_DOWNLOAD")
      }
      if (latestDraft && latestDraft.base_version !== locked.version) throw new Error("CATALOG_DRAFT_ALREADY_OUTDATED")
      const updated = replaceCatalog(locked.payload, replacements)
      const saved = await database.query(
        "UPDATE catalog_config SET payload=$1::jsonb,version=version+1,updated_at=now() WHERE id='primary' RETURNING version",
        [JSON.stringify(updated.payload)]
      )
      await database.query("INSERT INTO catalog_revisions(version,payload) VALUES($1,$2::jsonb)", [saved.rows[0].version, JSON.stringify(updated.payload)])
      let draftChanged = 0
      if (latestDraft) {
        const nextDraft = replaceCatalog(latestDraft.payload, replacements)
        draftChanged = nextDraft.changed
        await database.query(
          "UPDATE catalog_drafts SET payload=$1::jsonb,base_version=$2,updated_at=now() WHERE id='primary'",
          [JSON.stringify(nextDraft.payload), saved.rows[0].version]
        )
      }
      await database.query("COMMIT")
      console.log(`MIGRATED: ${replacements.size} sources; live image references changed: ${updated.changed}; draft: ${draftChanged}; new catalog version ${saved.rows[0].version}.`)
    } catch (error) {
      await database.query("ROLLBACK")
      throw error
    }
  }
} finally { await database.end() }
