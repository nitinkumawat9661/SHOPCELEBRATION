import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { isAdminRequest } from "../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { CatalogValidationError, discardCatalogDraft, getCatalogAdminState, saveCatalogDraft } from "../../../../lib/server/catalog"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await getCatalogAdminState()) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-catalog-get", error)
    return NextResponse.json({ ok: false, error: "CATALOG_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-draft", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ catalog?: unknown; version?: unknown }>(request, validation.catalogRequestMaxBytes)
    return NextResponse.json({ ok: true, ...(await saveCatalogDraft(body.catalog, body.version)) })
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-catalog-draft-save", error)
    return NextResponse.json({ ok: false, error: "CATALOG_DRAFT_SAVE_FAILED" }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-draft-discard", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ version?: unknown }>(request)
    return NextResponse.json({ ok: true, ...(await discardCatalogDraft(body.version)) })
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-catalog-draft-discard", error)
    return NextResponse.json({ ok: false, error: "CATALOG_DRAFT_DISCARD_FAILED" }, { status: 503 })
  }
}
