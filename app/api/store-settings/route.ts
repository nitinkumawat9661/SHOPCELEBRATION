import { NextResponse } from "next/server"
import { getStoreSettings } from "../../../lib/server/store-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getStoreSettings()) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("store-settings", error)
    return NextResponse.json({ ok: false, error: "SETTINGS_UNAVAILABLE" }, { status: 503 })
  }
}
