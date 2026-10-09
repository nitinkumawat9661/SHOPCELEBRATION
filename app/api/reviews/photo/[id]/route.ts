import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { approvedOrAdminPhotoKey } from "../../../../../lib/server/product-reviews"
import { readReviewPhoto } from "../../../../../lib/server/r2"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  try {
    const key = await approvedOrAdminPhotoKey(id, await isAdminRequest())
    if (!key) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
    return new NextResponse(new Uint8Array(await readReviewPhoto(key)), {
      headers: {
        "Content-Type": "image/webp", "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox"
      }
    })
  } catch (error) {
    console.error("review-photo", error)
    return NextResponse.json({ ok: false, error: "PHOTO_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
