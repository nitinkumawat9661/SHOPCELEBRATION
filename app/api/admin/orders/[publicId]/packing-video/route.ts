import { NextResponse } from "next/server"
import { validation } from "../../../../../../config/validation"
import { isAdminRequest } from "../../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../../lib/security/request"
import { findAdminPackingVideoKey, setPackingVideo } from "../../../../../../lib/server/orders"
import { createPackingVideoViewUrl, isPackingVideoKeyForOrder, verifyPackingVideoObject } from "../../../../../../lib/server/r2"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

export async function GET(_request: Request, context: { params: Promise<{ publicId: string }> }) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    const key = await findAdminPackingVideoKey((await context.params).publicId)
    if (!key || !isPackingVideoKeyForOrder(key, (await context.params).publicId)) {
      return NextResponse.json({ ok: false, error: "PACKING_VIDEO_NOT_READY" }, { status: 404 })
    }
    return NextResponse.redirect(await createPackingVideoViewUrl(key), 302)
  } catch (error) {
    console.error("admin-packing-video-view", error)
    return NextResponse.json({ ok: false, error: "UPLOAD_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-mutation", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ key?: unknown }>(request)
    const key = typeof body.key === "string" ? body.key.trim() : ""
    if (!isPackingVideoKeyForOrder(key, (await context.params).publicId)) return NextResponse.json({ ok: false, error: "INVALID_VIDEO_KEY" }, { status: 422 })
    if (!(await verifyPackingVideoObject(key))) return NextResponse.json({ ok: false, error: "INVALID_VIDEO_OBJECT" }, { status: 422 })

    const result = await setPackingVideo((await context.params).publicId, key)
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "ORDER_NOT_FOUND" ? 404 : 409 })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-packing-video", error)
    return NextResponse.json({ ok: false, error: "PACKING_VIDEO_UPDATE_FAILED" }, { status: 503 })
  }
}
