import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { appendCatalogImageChunk, assertCatalogImageUploadComplete, CATALOG_IMAGE_CHUNK_BYTES, CatalogImageUploadError, createCatalogImageUploadSession, deleteCatalogImageUploadSession } from "../../../../../lib/server/catalog-image-upload"
import { isCatalogImageMimeType, uploadCatalogImageFile, verifyCatalogImageObject } from "../../../../../lib/server/r2"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorResponse(error: unknown) {
  if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
  if (error instanceof CatalogImageUploadError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
  console.error("catalog-image-chunk-upload", error)
  return NextResponse.json({ ok: false, error: "IMAGE_UPLOAD_UNAVAILABLE" }, { status: 503 })
}

async function readChunk(request: Request) {
  const lengthHeader = request.headers.get("content-length")?.trim() || ""
  if (lengthHeader) {
    if (!/^\d+$/.test(lengthHeader)) throw new CatalogImageUploadError("INVALID_CONTENT_LENGTH", 400)
    const declared = Number(lengthHeader)
    if (!Number.isSafeInteger(declared) || declared <= 0 || declared > CATALOG_IMAGE_CHUNK_BYTES) {
      throw new CatalogImageUploadError("REQUEST_TOO_LARGE", 413)
    }
  }
  if (!request.body) throw new CatalogImageUploadError("INVALID_UPLOAD_REQUEST", 400)

  const reader = request.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > CATALOG_IMAGE_CHUNK_BYTES) {
        await reader.cancel()
        throw new CatalogImageUploadError("REQUEST_TOO_LARGE", 413)
      }
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (!total) throw new CatalogImageUploadError("INVALID_UPLOAD_REQUEST", 400)

  const merged = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.byteLength
  }
  return merged
}

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-image-init", request, validation.rateLimits.catalogUpload)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ contentType?: unknown; totalBytes?: unknown }>(request)
    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : ""
    const totalBytes = Number(body.totalBytes)
    if (!isCatalogImageMimeType(contentType)) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_TYPE" }, { status: 422 })
    if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || totalBytes > validation.catalogImageMaxBytes) {
      return NextResponse.json({ ok: false, error: "IMAGE_TOO_LARGE" }, { status: 413 })
    }

    return NextResponse.json({ ok: true, ...(await createCatalogImageUploadSession(contentType, totalBytes)) })
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
    if (!/^\d+$/.test(offsetRaw)) throw new CatalogImageUploadError("CATALOG_IMAGE_UPLOAD_OFFSET", 409)
    const result = await appendCatalogImageChunk(uploadId, Number(offsetRaw), await readChunk(request))
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-image-complete", request, validation.rateLimits.catalogUpload)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ uploadId?: unknown }>(request)
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : ""
    const assembled = await assertCatalogImageUploadComplete(uploadId)
    const uploaded = await uploadCatalogImageFile(
      assembled.session.contentType,
      assembled.filePath,
      assembled.size
    )
    if (!(await verifyCatalogImageObject(uploaded.key))) {
      return NextResponse.json({ ok: false, error: "INVALID_IMAGE_OBJECT" }, { status: 422 })
    }
    await deleteCatalogImageUploadSession(uploadId)
    return NextResponse.json({ ok: true, imageUrl: `/api/catalog/image?key=${encodeURIComponent(uploaded.key)}` })
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
    await deleteCatalogImageUploadSession(uploadId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
