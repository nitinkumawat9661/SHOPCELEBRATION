import { NextResponse } from "next/server"
import { createCatalogImageViewUrl, isCatalogImageKey } from "../../../../lib/server/r2"

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || ""
  if (!isCatalogImageKey(key)) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_KEY" }, { status: 404 })
  try {
    const signedUrl = await createCatalogImageViewUrl(key)
    const upstream = await fetch(signedUrl, { cache: "no-store" })
    if (!upstream.ok) throw new Error(`R2_${upstream.status}`)
    const type = upstream.headers.get("content-type") || "application/octet-stream"
    if (!type.startsWith("image/")) throw new Error("INVALID_IMAGE_TYPE")
    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        "X-Content-Type-Options": "nosniff"
      }
    })
  } catch (error) {
    console.error("catalog-image", error)
    return NextResponse.json({ ok: false, error: "IMAGE_UNAVAILABLE" }, { status: 404 })
  }
}
