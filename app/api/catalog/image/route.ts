import { NextResponse } from "next/server"
import { createCatalogImageViewUrl, isCatalogImageKey } from "../../../../lib/server/r2"
import { publicCatalogImageCacheControl } from "../../../../lib/domain/catalog-image-cache"
import { resizePublicCatalogImage, requestedPublicCatalogImageWidth } from "../../../../lib/server/public-catalog-image-resize"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const key = params.get("key") || ""
  const imageWidth = requestedPublicCatalogImageWidth(params)
  if (!isCatalogImageKey(key)) return NextResponse.json({ ok: false, error: "INVALID_IMAGE_KEY" }, { status: 404 })
  try {
    const signedUrl = await createCatalogImageViewUrl(key)
    const upstream = await fetch(signedUrl, { cache: "no-store" })
    if (!upstream.ok) throw new Error(`R2_${upstream.status}`)
    const type = upstream.headers.get("content-type") || "application/octet-stream"
    if (!type.startsWith("image/")) throw new Error("INVALID_IMAGE_TYPE")
    const original = Buffer.from(await upstream.arrayBuffer())
    const resized = imageWidth && type !== "image/svg+xml"
      ? await resizePublicCatalogImage(original, imageWidth)
      : null
    // If decoding unsupported legacy media fails, keep the original SAME-SKU
    // image. Never replace a catalogue image with another product photo.
    const bytes = resized || original
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": resized ? "image/webp" : type,
        "Vary": "Accept",
        "Cache-Control": publicCatalogImageCacheControl(key),
        "X-Content-Type-Options": "nosniff"
      }
    })
  } catch (error) {
    console.error("catalog-image", error)
    return NextResponse.json({ ok: false, error: "IMAGE_UNAVAILABLE" }, { status: 404 })
  }
}
