import { NextResponse } from "next/server"
import { validation } from "../../../../../../config/validation"
import { isOrderStatus } from "../../../../../../lib/domain/order-status"
import { isAdminRequest } from "../../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../../lib/security/request"
import { updateOrderStatus } from "../../../../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-mutation", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<{ status?: unknown }>(request)
    if (!isOrderStatus(body.status)) return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 422 })
    const result = await updateOrderStatus((await context.params).publicId, body.status)
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "ORDER_NOT_FOUND" ? 404 : 409 })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-status", error)
    return NextResponse.json({ ok: false, error: "STATUS_UPDATE_FAILED" }, { status: 503 })
  }
}
