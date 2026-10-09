import { NextResponse } from "next/server"
import { validation } from "../../../../config/validation"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { findCustomerAccountById } from "../../../../lib/server/customer-accounts"
import { query } from "../../../../lib/server/db"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { hasUnsafeText, sanitizeText } from "../../../../lib/validation/text"
import type { DeliveryAddress } from "../../../../lib/domain/delivery-address"

export const dynamic = "force-dynamic"

async function authorized() {
  const session = await getCustomerSession()
  if (!session || !await findCustomerAccountById(session.accountId)) return null
  return session.accountId
}

function validateAddress(input: unknown): DeliveryAddress | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const fields = { ...(input as Record<string, unknown>) }
  if (typeof fields.address === "string") fields.address = fields.address.replace(/\r\n?|\n/g, ", ")
  const required = ["receiverName", "address", "city", "state", "pincode"] as const
  if (required.some((key) => typeof fields[key] !== "string" || hasUnsafeText(fields[key]))) return null
  const receiverName = sanitizeText(fields.receiverName, validation.name.max)
  const address = sanitizeText(fields.address, validation.address.max)
  const city = sanitizeText(fields.city, validation.city.max)
  const state = sanitizeText(fields.state, validation.state.max)
  const pincode = sanitizeText(fields.pincode, 6)
  if (receiverName.length < validation.name.min || address.length < validation.address.min
    || city.length < 2 || state.length < 2 || !/^\d{6}$/.test(pincode)) return null
  // Reject silent truncation so incomplete addresses cannot become defaults.
  if (required.some((key) => (fields[key] as string).normalize("NFKC").trim().length > ({
    receiverName: validation.name.max, address: validation.address.max,
    city: validation.city.max, state: validation.state.max, pincode: 6
  })[key])) return null
  return { receiverName, address, city, state, pincode }
}

export async function GET() {
  try {
    const accountId = await authorized()
    if (!accountId) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const result = await query<{ default_address: DeliveryAddress | null }>(
      "SELECT default_address FROM customer_accounts WHERE id = $1 AND status = 'active' LIMIT 1", [accountId])
    return NextResponse.json({ ok: true, address: result.rows[0]?.default_address || null }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("customer-address-get", error)
    return NextResponse.json({ ok: false, error: "ADDRESS_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request)
    const accountId = await authorized()
    if (!accountId) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const allowed = await consumeRequestRateLimit("customer-address", request, validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
    const body = await readJsonBody<{ address?: unknown }>(request)
    const address = validateAddress(body.address)
    if (!address) return NextResponse.json({ ok: false, error: "INVALID_ADDRESS" }, { status: 422 })
    await query("UPDATE customer_accounts SET default_address = $2::jsonb, updated_at = now() WHERE id = $1 AND status = 'active'",
      [accountId, JSON.stringify(address)])
    return NextResponse.json({ ok: true, address }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
    console.error("customer-address-save", error)
    return NextResponse.json({ ok: false, error: "ADDRESS_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
