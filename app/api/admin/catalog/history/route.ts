import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { CatalogValidationError, listCatalogRevisions, rollbackCatalogRevision } from "../../../../../lib/server/catalog"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, revisions: await listCatalogRevisions() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("catalog-history", error)
    return NextResponse.json({ ok: false, error: "HISTORY_UNAVAILABLE" }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-history", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ revisionId?: unknown }>(request)
    const revisionId = String(body.revisionId ?? "").trim()
    return NextResponse.json({ ok: true, ...(await rollbackCatalogRevision(revisionId)) })
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("catalog-rollback", error)
    return NextResponse.json({ ok: false, error: "ROLLBACK_FAILED" }, { status: 503 })
  }
}
