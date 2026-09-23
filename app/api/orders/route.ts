import { NextResponse } from "next/server"
import { requireEnv } from "../../../config/env"
import { publicEnv } from "../../../config/public-env"
import { routes } from "../../../config/routes"
import { validation } from "../../../config/validation"
import { normalizeOrderInput, OrderValidationError, type CreateOrderInput } from "../../../lib/domain/order"
import { getCustomerSession } from "../../../lib/security/customer-session"
import { getCatalogConfig } from "../../../lib/server/catalog"
import { CampaignError } from "../../../lib/server/campaigns"
import { findCustomerAccountById } from "../../../lib/server/customer-accounts"
import { createOrder } from "../../../lib/server/orders"
import { consumeRequestRateLimit } from "../../../lib/server/rate-limit"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../lib/security/request"

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request)
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    if (!publicEnv.upiId || !publicEnv.upiName) return NextResponse.json({ ok: false, error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 })
    const allowed = await consumeRequestRateLimit("order", request, validation.rateLimits.createOrder)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })

    const body = await readJsonBody<CreateOrderInput>(request)
    const { catalog } = await getCatalogConfig()
    const order = normalizeOrderInput({ ...body, phone: account.phone }, requireEnv("businessTimezone"), catalog)
    const created = await createOrder(order, account.id, body.offerQuoteId)

    return NextResponse.json({
      ok: true,
      orderId: created.publicId,
      trackingToken: created.trackingToken,
      trackingPath: `${routes.track}?token=${encodeURIComponent(created.trackingToken)}`,
      accountPath: routes.account,
      whatsappReady: Boolean(publicEnv.whatsapp),
      subtotalPaise: created.pricing.subtotalPaise,
      discountPaise: created.pricing.discountPaise,
      payablePaise: created.pricing.payablePaise,
      campaignId: created.pricing.campaignId,
      campaignTitle: created.pricing.campaignTitle
    })
  } catch (error) {
    if (error instanceof OrderValidationError) return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    if (error instanceof CampaignError) {
      const status = ["OFFER_QUOTE_EXPIRED", "OFFER_QUOTE_USED"].includes(error.code) ? 409 : 422
      return NextResponse.json({ ok: false, error: error.code }, { status })
    }
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    const dbError = error as { code?: string; constraint?: string }
    if (dbError.code === "23505" && dbError.constraint?.includes("payment_reference_hash")) {
      return NextResponse.json({ ok: false, error: "PAYMENT_REFERENCE_ALREADY_USED" }, { status: 409 })
    }
    console.error("create-order", error)
    return NextResponse.json({ ok: false, error: "ORDER_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
