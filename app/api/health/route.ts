import { NextResponse } from "next/server"
import { storeContent } from "../../../lib/domain/content"
import { query } from "../../../lib/server/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await query("SELECT 1")
    return NextResponse.json({
      ok: true,
      service: storeContent.brand.name,
      timestamp: new Date().toISOString()
    }, {
      headers: { "Cache-Control": "no-store" }
    })
  } catch (error) {
    console.error("health-check", error)
    return NextResponse.json({
      ok: false,
      service: storeContent.brand.name
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    })
  }
}
