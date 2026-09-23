import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { canPreparePackingVideo } from "../../../../lib/server/orders"
import { isPackingVideoMimeType } from "../../../../lib/domain/storage"
import { createPackingVideoUploadUrl } from "../../../../lib/server/r2"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("packing-upload", request, validation.rateLimits.packingUpload)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ orderId?: unknown; contentType?: unknown }>(request)
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : ""
    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : ""
    if (!orderId || !isPackingVideoMimeType(contentType)) return NextResponse.json({ ok: false, error: "INVALID_UPLOAD_REQUEST" }, { status: 422 })
    if (!(await canPreparePackingVideo(orderId))) return NextResponse.json({ ok: false, error: "PACKING_VIDEO_UPLOAD_NOT_ALLOWED" }, { status: 409 })

    const upload = await createPackingVideoUploadUrl(orderId, contentType)
    return NextResponse.json({ ok: true, ...upload })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("packing-video-presign", error)
    return NextResponse.json({ ok: false, error: "UPLOAD_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
