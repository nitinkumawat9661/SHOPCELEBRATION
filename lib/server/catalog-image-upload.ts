import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { CatalogImageMimeType } from "../../config/storage"
import { validation } from "../../config/validation"

const ROOT = "/tmp/celebration-catalog-image-uploads"
export const CATALOG_IMAGE_CHUNK_BYTES = 1_500_000
const SESSION_TTL_MS = 30 * 60 * 1000

type UploadSession = {
  uploadId: string
  contentType: CatalogImageMimeType
  totalBytes: number
  createdAt: number
}

export class CatalogImageUploadError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code)
  }
}

function validId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
function metaPath(uploadId: string) {
  if (!validId(uploadId)) throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_INVALID", 400)
  return path.join(ROOT, `${uploadId}.json`)
}
function dataPath(uploadId: string) {
  if (!validId(uploadId)) throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_INVALID", 400)
  return path.join(ROOT, `${uploadId}.part`)
}
async function ensureRoot() { await mkdir(ROOT, { recursive: true, mode: 0o700 }) }
async function cleanupStale() {
  await ensureRoot()
  const now = Date.now()
  const entries = await readdir(ROOT).catch(() => [])
  await Promise.all(entries.map(async (name) => {
    const full = path.join(ROOT, name)
    try {
      const info = await stat(full)
      if (now - info.mtimeMs > SESSION_TTL_MS) await rm(full, { force: true })
    } catch {}
  }))
}

export async function createCatalogImageUploadSession(contentType: CatalogImageMimeType, totalBytes: number) {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || totalBytes > validation.catalogImageMaxBytes) {
    throw new CatalogImageUploadError("IMAGE_TOO_LARGE", 413)
  }
  await cleanupStale()
  const uploadId = randomUUID()
  const session: UploadSession = { uploadId, contentType, totalBytes, createdAt: Date.now() }
  await writeFile(metaPath(uploadId), JSON.stringify(session), { encoding: "utf8", mode: 0o600, flag: "wx" })
  await writeFile(dataPath(uploadId), Buffer.alloc(0), { mode: 0o600, flag: "wx" })
  return { uploadId, chunkSize: CATALOG_IMAGE_CHUNK_BYTES }
}

export async function readCatalogImageUploadSession(uploadId: string) {
  await ensureRoot()
  let raw = ""
  try { raw = await readFile(metaPath(uploadId), "utf8") }
  catch { throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_INVALID", 404) }

  let session: UploadSession
  try { session = JSON.parse(raw) as UploadSession }
  catch { throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_INVALID", 400) }

  if (session.uploadId !== uploadId || !Number.isSafeInteger(session.totalBytes) || !Number.isFinite(session.createdAt)) {
    throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_INVALID", 400)
  }
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    await deleteCatalogImageUploadSession(uploadId)
    throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_EXPIRED", 410)
  }
  return session
}

export async function appendCatalogImageChunk(uploadId: string, offset: number, chunk: Uint8Array) {
  const session = await readCatalogImageUploadSession(uploadId)
  if (!Number.isSafeInteger(offset) || offset < 0) throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_OFFSET", 409)
  if (chunk.byteLength <= 0 || chunk.byteLength > CATALOG_IMAGE_CHUNK_BYTES) throw new CatalogImageUploadError("REQUEST_TOO_LARGE", 413)

  const file = dataPath(uploadId)
  const info = await stat(file)
  if (offset < info.size) {
    if (offset + chunk.byteLength <= info.size) return { receivedBytes: info.size, totalBytes: session.totalBytes }
    throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_OFFSET", 409)
  }
  if (offset !== info.size || offset + chunk.byteLength > session.totalBytes) {
    throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_OFFSET", 409)
  }

  const handle = await open(file, "r+")
  try { await handle.write(chunk, 0, chunk.byteLength, offset) }
  finally { await handle.close() }
  return { receivedBytes: offset + chunk.byteLength, totalBytes: session.totalBytes }
}

export async function assertCatalogImageUploadComplete(uploadId: string) {
  const session = await readCatalogImageUploadSession(uploadId)
  const info = await stat(dataPath(uploadId))
  if (info.size !== session.totalBytes) throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_INCOMPLETE", 409)
  return { session, filePath: dataPath(uploadId), size: info.size }
}

export async function deleteCatalogImageUploadSession(uploadId: string) {
  if (!validId(uploadId)) return
  await Promise.all([
    rm(metaPath(uploadId), { force: true }).catch(() => {}),
    rm(dataPath(uploadId), { force: true }).catch(() => {})
  ])
}
