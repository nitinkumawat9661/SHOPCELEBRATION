import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isPackingVideoMimeType } from "../../../../lib/domain/storage"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { canPreparePackingVideo, setPackingVideo } from "../../../../lib/server/orders"
import {
  appendPackingVideoChunk,
  assertPackingVideoUploadComplete,
  createPackingVideoUploadSession,
  deletePackingVideoUploadSession,
  PACKING_VIDEO_CHUNK_BYTES,
  PackingVideoUploadError
} from "../../../../lib/server/packing-video-upload"
import { uploadPackingVideoFile, verifyPackingVideoObject } from "../../../../lib/server/r2"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorResponse(error: unknown) {
  if (error instanceof RequestSecurityError) {
    return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
  }
  if (error instanceof PackingVideoUploadError) {
    return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
  }
  console.error("packing-video-chunked-upload", error)
  return NextResponse.json({ ok: false, error: "UPLOAD_SERVICE_UNAVAILABLE" }, { status: 503 })
}

async function readChunk(request: Request) {
  const header = request.headers.get("content-length")?.trim() || ""
  if (header) {
    if (!/^\d+$/.test(header)) throw new PackingVideoUploadError("INVALID_CONTENT_LENGTH", 400)
    const declared = Number(header)
    if (!Number.isSafeInteger(declared) || declared <= 0 || declared > PACKING_VIDEO_CHUNK_BYTES) {
      throw new PackingVideoUploadError("REQUEST_TOO_LARGE", 413)
    }
  }
  if (!request.body) throw new PackingVideoUploadError("INVALID_UPLOAD_REQUEST", 400)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > PACKING_VIDEO_CHUNK_BYTES) {
        await reader.cancel()
        throw new PackingVideoUploadError("REQUEST_TOO_LARGE", 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (!total) throw new PackingVideoUploadError("INVALID_UPLOAD_REQUEST", 400)

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("packing-upload-init", request, validation.rateLimits.packingUpload)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ orderId?: unknown; contentType?: unknown; totalBytes?: unknown }>(request)
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : ""
    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : ""
    const totalBytes = Number(body.totalBytes)

    if (!orderId || !isPackingVideoMimeType(contentType)) {
      return NextResponse.json({ ok: false, error: "INVALID_UPLOAD_REQUEST" }, { status: 422 })
    }
    if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || totalBytes > validation.packingVideoMaxBytes) {
      return NextResponse.json({ ok: false, error: "PACKING_VIDEO_TOO_LARGE" }, { status: 413 })
    }
    if (!(await canPreparePackingVideo(orderId))) {
      return NextResponse.json({ ok: false, error: "PACKING_VIDEO_UPLOAD_NOT_ALLOWED" }, { status: 409 })
    }

    const session = await createPackingVideoUploadSession({ orderId, contentType, totalBytes })
    return NextResponse.json({ ok: true, ...session })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const url = new URL(request.url)
    const uploadId = url.searchParams.get("uploadId")?.trim() || ""
    const offsetRaw = request.headers.get("x-upload-offset")?.trim() || ""
    if (!/^\d+$/.test(offsetRaw)) throw new PackingVideoUploadError("PACKING_UPLOAD_OFFSET_MISMATCH", 409)

    const chunk = await readChunk(request)
    const result = await appendPackingVideoChunk(uploadId, Number(offsetRaw), chunk)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("packing-upload-complete", request, validation.rateLimits.packingUpload)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ uploadId?: unknown }>(request)
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : ""
    const assembled = await assertPackingVideoUploadComplete(uploadId)

    if (!(await canPreparePackingVideo(assembled.session.orderId))) {
      return NextResponse.json({ ok: false, error: "PACKING_VIDEO_UPLOAD_NOT_ALLOWED" }, { status: 409 })
    }

    const uploaded = await uploadPackingVideoFile(
      assembled.session.orderId,
      assembled.session.contentType,
      assembled.filePath,
      assembled.size
    )
    if (!(await verifyPackingVideoObject(uploaded.key))) {
      return NextResponse.json({ ok: false, error: "INVALID_VIDEO_OBJECT" }, { status: 422 })
    }

    const saved = await setPackingVideo(assembled.session.orderId, uploaded.key)
    if (!saved.ok) {
      return NextResponse.json(saved, { status: saved.code === "ORDER_NOT_FOUND" ? 404 : 409 })
    }

    await deletePackingVideoUploadSession(uploadId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const body = await readJsonBody<{ uploadId?: unknown }>(request)
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : ""
    await deletePackingVideoUploadSession(uploadId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
