import { NextResponse } from "next/server"
import { getCatalogConfig } from "../../../lib/server/catalog"
import { getTierPopularity } from "../../../lib/server/orders"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await getCatalogConfig()
    const socialProof = await getTierPopularity().catch((error) => {
      console.error("catalog-social-proof", error)
      return null
    })
    return NextResponse.json({ ok: true, ...result, socialProof }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("public-catalog", error)
    return NextResponse.json({ ok: false, error: "CATALOG_UNAVAILABLE" }, { status: 503 })
  }
}
