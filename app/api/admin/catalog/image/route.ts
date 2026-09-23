import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { createCatalogImageUploadUrl, isCatalogImageKey, isCatalogImageMimeType, verifyCatalogImageObject } from "../../../../../lib/server/r2"
import { sanitizeText } from "../../../../../lib/validation/text"

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-image", request, validation.rateLimits.catalogUpload)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ contentType?: unknown; key?: unknown }>(request)
    const key = sanitizeText(body.key, 260)
    if (key) {
      if (!isCatalogImageKey(key)) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_KEY" }, { status: 422 })
      if (!(await verifyCatalogImageObject(key))) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_OBJECT" }, { status: 422 })
      return NextResponse.json({ ok: true, imageUrl: `/api/catalog/image?key=${encodeURIComponent(key)}` })
    }
    const contentType = sanitizeText(body.contentType, 80)
    if (!isCatalogImageMimeType(contentType)) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_TYPE" }, { status: 422 })
    return NextResponse.json({ ok: true, ...(await createCatalogImageUploadUrl(contentType)) })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-catalog-image", error)
    return NextResponse.json({ ok: false, error: "IMAGE_UPLOAD_UNAVAILABLE" }, { status: 503 })
  }
}
