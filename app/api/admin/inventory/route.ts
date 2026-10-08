import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { setInventoryQuantity } from "../../../../lib/server/inventory"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-inventory", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ productId?: unknown; quantity?: unknown }>(request)
    const inventory = await setInventoryQuantity(body.productId, body.quantity)
    return NextResponse.json({ ok: true, inventory }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    const code = error instanceof Error ? error.message : "INVENTORY_UPDATE_FAILED"
    const status = ["INVALID_PRODUCT_ID", "INVALID_STOCK_QUANTITY"].includes(code) ? 422 : 503
    return NextResponse.json({ ok: false, error: code }, { status })
  }
}
