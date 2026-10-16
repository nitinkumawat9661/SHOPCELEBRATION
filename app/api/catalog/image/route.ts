import { NextResponse } from "next/server"
import { isCatalogImageKey, readCatalogImageObject } from "../../../../lib/server/r2"

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || ""
  if (!isCatalogImageKey(key)) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_KEY" }, { status: 404 })
  try {
    // One direct R2 request; no Meesho URL, redirect or temporary presigned
    // download. Existing thumb/main/zoom WebP assets remain byte-for-byte.
    const { bytes, type } = await readCatalogImageObject(key)
    const immutable = /^catalog\/rehost\/meesho\/[a-f0-9]{64}\/(?:thumb|main|zoom)\.webp$/.test(key)
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": immutable
          ? "public, max-age=604800, immutable"
          : "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff"
      }
    })
  } catch (error) {
    console.error("catalog-image", error)
    return NextResponse.json({ ok: false, error: "IMAGE_UNAVAILABLE" }, { status: 404 })
  }
}
