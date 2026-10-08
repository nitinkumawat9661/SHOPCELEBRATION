import { NextResponse } from "next/server"
import { adminPasskeyCount } from "../../../../../lib/server/admin-passkeys"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await adminPasskeyCount()
    return NextResponse.json({ ok: true, enabled: count > 0, count }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("admin-passkey-status", error)
    return NextResponse.json({ ok: false, error: "PASSKEY_STATUS_UNAVAILABLE" }, { status: 503 })
  }
}
