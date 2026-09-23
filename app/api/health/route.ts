import { NextResponse } from "next/server"
import { storeContent } from "../../../lib/domain/content"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, service: storeContent.brand.name, timestamp: new Date().toISOString() })
}
