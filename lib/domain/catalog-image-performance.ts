/**
 * Responsive delivery for the 22 existing same-SKU first-party necklace PNGs.
 * Card-only Next optimizer routing: the SKU/photo ownership in the database,
 * product detail page, gallery and Google structured-data remains untouched.
 *
 * Next image widths are from the default allowed device/image size lists.
 * Quality 75 is the supported Next 16 default; retain original PNG as fallback
 * when the optimizer/variant fails or image optimization is disabled.
 */
const SITE_ORIGIN = "https://shopcelebration.in"
const OWNED_NECKLACE_PNG = /^\/catalog\/necklaces\/celebration-necklace-\d{3}\.png$/

export type ResponsiveCardImage = {
  src: string
  srcSet: string
  sizes: string
}

export function responsiveFirstPartyCardImage(src: string, variant: "thumb" | "main"): ResponsiveCardImage | null {
  let url: URL
  try { url = new URL(src, SITE_ORIGIN) } catch { return null }
  if (url.origin !== SITE_ORIGIN || url.search || url.hash || !OWNED_NECKLACE_PNG.test(url.pathname)) return null

  const local = encodeURIComponent(url.pathname)
  const optimized = (width: number) => `/_next/image?url=${local}&w=${width}&q=75`
  return {
    src: optimized(variant === "main" ? 828 : 640),
    srcSet: [384, 640, 828].map((width) => `${optimized(width)} ${width}w`).join(", "),
    sizes: "(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 260px"
  }
}

// All live R2 catalog images are already delivered by the same-origin,
// public-only catalog image endpoint; its constrained w parameter returns
// an actual resized/quality-controlled WebP, not merely a resized CSS box.
// Leave private order/review/claim media untouched.
export function responsivePublicCatalogImage(src: string, variant: "thumb" | "main" | "category"): ResponsiveCardImage | null {
  let url: URL
  try { url = new URL(src, SITE_ORIGIN) } catch { return null }
  if (url.origin !== SITE_ORIGIN || url.pathname !== "/api/catalog/image") return null
  if ([...url.searchParams.keys()].some((param) => param !== "key")) return null
  const key = url.searchParams.get("key") || ""
  if (!/^catalog\/[A-Za-z0-9._/-]+\.(?:webp|png|jpg|jpeg)$/i.test(key) || key.includes("..")) return null
  const responsive = (width: number) => {
    const params = new URLSearchParams({ key, w: String(width) })
    return `/api/catalog/image?${params.toString()}`
  }
  const category = variant === "category"
  return {
    src: responsive(category ? 384 : variant === "main" ? 640 : 384),
    srcSet: (category ? [192, 256, 384] : [256, 384, 640, 828])
      .map((width) => `${responsive(width)} ${width}w`).join(", "),
    sizes: category
      ? "(max-width: 640px) 47vw, 190px"
      : "(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 300px"
  }
}
