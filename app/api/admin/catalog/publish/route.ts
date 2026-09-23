import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { CatalogValidationError, publishCatalogDraft } from "../../../../../lib/server/catalog"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  try {
    enforceSameOrigin(request)
    const allowed = await consumeRequestRateLimit("admin-catalog-publish", request, validation.rateLimits.adminMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ version?: unknown }>(request)
    return NextResponse.json({ ok: true, ...(await publishCatalogDraft(body.version)) })
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("admin-catalog-publish", error)
    return NextResponse.json({ ok: false, error: "CATALOG_PUBLISH_FAILED" }, { status: 503 })
  }
}
