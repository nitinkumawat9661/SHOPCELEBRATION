import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, rm, stat, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import type { PackingVideoMimeType } from "../../config/storage"
import { validation } from "../../config/validation"

const ROOT = "/tmp/celebration-packing-video-uploads"
export const PACKING_VIDEO_CHUNK_BYTES = 1_500_000
const SESSION_TTL_MS = 60 * 60 * 1000

type UploadSession = {
  uploadId: string
  orderId: string
  contentType: PackingVideoMimeType
  totalBytes: number
  createdAt: number
}

export class PackingVideoUploadError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code)
  }
}

function safeUploadId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function metaPath(uploadId: string) {
  if (!safeUploadId(uploadId)) throw new PackingVideoUploadError("PACKING_UPLOAD_SESSION_INVALID", 400)
  return path.join(ROOT, `${uploadId}.json`)
}

function dataPath(uploadId: string) {
  if (!safeUploadId(uploadId)) throw new PackingVideoUploadError("PACKING_UPLOAD_SESSION_INVALID", 400)
  return path.join(ROOT, `${uploadId}.part`)
}

async function ensureRoot() {
  await mkdir(ROOT, { recursive: true, mode: 0o700 })
}

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

export async function createPackingVideoUploadSession(input: {
  orderId: string
  contentType: PackingVideoMimeType
  totalBytes: number
}) {
  if (!Number.isSafeInteger(input.totalBytes) || input.totalBytes <= 0 || input.totalBytes > validation.packingVideoMaxBytes) {
    throw new PackingVideoUploadError("PACKING_VIDEO_TOO_LARGE", 413)
  }
  await cleanupStale()
  const uploadId = randomUUID()
  const session: UploadSession = {
    uploadId,
    orderId: input.orderId,
    contentType: input.contentType,
    totalBytes: input.totalBytes,
    createdAt: Date.now()
  }
  await writeFile(metaPath(uploadId), JSON.stringify(session), { encoding: "utf8", mode: 0o600, flag: "wx" })
  await writeFile(dataPath(uploadId), Buffer.alloc(0), { mode: 0o600, flag: "wx" })
  return { uploadId, chunkSize: PACKING_VIDEO_CHUNK_BYTES }
}

export async function readPackingVideoUploadSession(uploadId: string) {
  await ensureRoot()
  let raw = ""
  try {
    raw = await readFile(metaPath(uploadId), "utf8")
  } catch {
    throw new PackingVideoUploadError("PACKING_UPLOAD_SESSION_INVALID", 404)
  }
  let session: UploadSession
  try {
    session = JSON.parse(raw) as UploadSession
  } catch {
    throw new PackingVideoUploadError("PACKING_UPLOAD_SESSION_INVALID", 400)
  }
  if (
    session.uploadId !== uploadId ||
    typeof session.orderId !== "string" ||
    typeof session.contentType !== "string" ||
    !Number.isSafeInteger(session.totalBytes) ||
    !Number.isFinite(session.createdAt)
  ) {
    throw new PackingVideoUploadError("PACKING_UPLOAD_SESSION_INVALID", 400)
  }
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    await deletePackingVideoUploadSession(uploadId)
    throw new PackingVideoUploadError("PACKING_UPLOAD_SESSION_EXPIRED", 410)
  }
  return session
}

export async function appendPackingVideoChunk(uploadId: string, offset: number, chunk: Uint8Array) {
  const session = await readPackingVideoUploadSession(uploadId)
  if (!Number.isSafeInteger(offset) || offset < 0) throw new PackingVideoUploadError("PACKING_UPLOAD_OFFSET_MISMATCH", 409)
  if (chunk.byteLength <= 0 || chunk.byteLength > PACKING_VIDEO_CHUNK_BYTES) {
    throw new PackingVideoUploadError("REQUEST_TOO_LARGE", 413)
  }

  const file = dataPath(uploadId)
  const info = await stat(file)
  if (offset < info.size) {
    if (offset + chunk.byteLength <= info.size) return { receivedBytes: info.size, totalBytes: session.totalBytes }
    throw new PackingVideoUploadError("PACKING_UPLOAD_OFFSET_MISMATCH", 409)
  }
  if (offset !== info.size || offset + chunk.byteLength > session.totalBytes) {
    throw new PackingVideoUploadError("PACKING_UPLOAD_OFFSET_MISMATCH", 409)
  }

  const handle = await open(file, "r+")
  try {
    await handle.write(chunk, 0, chunk.byteLength, offset)
  } finally {
    await handle.close()
  }

  const nextSize = offset + chunk.byteLength
  return { receivedBytes: nextSize, totalBytes: session.totalBytes }
}

export async function assertPackingVideoUploadComplete(uploadId: string) {
  const session = await readPackingVideoUploadSession(uploadId)
  const info = await stat(dataPath(uploadId))
  if (info.size !== session.totalBytes) throw new PackingVideoUploadError("PACKING_UPLOAD_INCOMPLETE", 409)
  return { session, filePath: dataPath(uploadId), size: info.size }
}

export async function deletePackingVideoUploadSession(uploadId: string) {
  if (!safeUploadId(uploadId)) return
  await Promise.all([
    rm(metaPath(uploadId), { force: true }).catch(() => {}),
    rm(dataPath(uploadId), { force: true }).catch(() => {})
  ])
}
