import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import type { CampaignTrigger } from "../../../../lib/domain/campaign"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { CampaignError, createBestOfferQuote } from "../../../../lib/server/campaigns"
import { getCatalogConfig } from "../../../../lib/server/catalog"
import { findCustomerAccountById } from "../../../../lib/server/customer-accounts"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"

export const dynamic = "force-dynamic"

type QuoteInput = {
  tierId?: unknown
  selectedProductIds?: unknown
  trigger?: unknown
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const allowed = await consumeRequestRateLimit("offer-quote", request, validation.rateLimits.offerQuote)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<QuoteInput>(request)
    const tierId = typeof body.tierId === "string" ? body.tierId : ""
    const selectedProductIds = Array.isArray(body.selectedProductIds)
      ? body.selectedProductIds.filter((value): value is string => typeof value === "string")
      : []
    const trigger: CampaignTrigger = body.trigger === "hesitation" ? "hesitation" : "checkout"
    const { catalog } = await getCatalogConfig()
    const quote = await createBestOfferQuote({ customerAccountId: account.id, tierId, selectedProductIds, trigger, catalog })
    return NextResponse.json({ ok: true, quote }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CampaignError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("offer-quote", error)
    return NextResponse.json({ ok: false, error: "OFFER_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
