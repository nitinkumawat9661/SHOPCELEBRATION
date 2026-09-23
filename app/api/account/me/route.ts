import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { findCustomerAccountById } from "../../../../lib/server/customer-accounts"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: true, account: null }, { headers: { "Cache-Control": "no-store" } })
    const account = await findCustomerAccountById(session.accountId)
    return NextResponse.json({ ok: true, account: account ? { ...account, phoneVerified: false } : null }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("customer-me", error)
    return NextResponse.json({ ok: false, error: "ACCOUNT_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
