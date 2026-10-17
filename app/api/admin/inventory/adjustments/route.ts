import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { validation } from "../../../../../config/validation"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import {
  applyAdminInventoryAdjustment, InventoryAdjustmentError, listAdminInventoryAdjustments
} from "../../../../../lib/server/admin-inventory-adjustments"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noStore })
  }
  try {
    const url = new URL(request.url)
    const items = await listAdminInventoryAdjustments(url.searchParams.get("productId"), url.searchParams.get("limit") || 40)
    return NextResponse.json({ ok: true, items }, { headers: noStore })
  } catch (error) {
    if (error instanceof InventoryAdjustmentError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers: noStore })
    }
    console.error("admin-inventory-adjustment-history", error)
    return NextResponse.json({ ok: false, error: "INVENTORY_HISTORY_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
}

export async function POST(request: Request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noStore })
  }
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-v3-inventory-adjustment", request, validation.rateLimits.adminMutation)
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
    }
    const body = await readJsonBody<{
      requestId?: unknown
      productId?: unknown
      mode?: unknown
      quantity?: unknown
      expectedAvailable?: unknown
      reason?: unknown
    }>(request)
    const result = await applyAdminInventoryAdjustment({
      requestId: body.requestId,
      productId: body.productId,
      mode: body.mode,
      quantity: body.quantity,
      expectedAvailable: body.expectedAvailable,
      reason: body.reason
    })
    return NextResponse.json({ ok: true, adjustment: result }, { headers: noStore })
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers: noStore })
    }
    if (error instanceof InventoryAdjustmentError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status, headers: noStore })
    }
    console.error("admin-inventory-adjustment", error)
    return NextResponse.json({ ok: false, error: "INVENTORY_ADJUSTMENT_FAILED" }, { status: 503, headers: noStore })
  }
}
