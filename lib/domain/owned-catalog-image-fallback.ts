/**
 * Customer-visible fallback can ONLY use another image variant on the
 * Celebration-owned R2 storage. Legacy source photo URLs are retained in
 * the catalog as audited provenance but must never become a browser fallback
 * (the old Meesho CDN has caused slow loads/blank cards).
 *
 * There is no cross-product substitution. The original image source hash
 * remains part of the verified per-SKU R2 key.
 */
const OWNED_IMAGE_PREFIX = "https://shopcelebration.in"
const REHOST_VARIANT = /^catalog\/rehost\/meesho\/([a-f0-9]{64})\/(thumb|main|zoom)\.webp$/

export function ownedR2ImageFallback(imageUrl: string): string | undefined {
  try {
    const url = new URL(imageUrl, OWNED_IMAGE_PREFIX)
    if (url.origin !== OWNED_IMAGE_PREFIX || url.pathname !== "/api/catalog/image") return undefined
    if ([...url.searchParams.keys()].some((key) => key !== "key")) return undefined
    const key = url.searchParams.get("key") || ""
    const match = key.match(REHOST_VARIANT)
    if (!match) return undefined
    const alt = match[2] === "thumb" ? "main" : match[2] === "main" ? "zoom" : "main"
    return `/api/catalog/image?key=${encodeURIComponent(`catalog/rehost/meesho/${match[1]}/${alt}.webp`)}`
  } catch {
    return undefined
  }
}

export function locallyOwnedImageFallback(imageUrl: string, legacyFallback?: string): string | undefined {
  // Generated local WebP may be absent after a misconfigured deployment.
  // Fall back ONLY to this same necklace's permanent original photo.
  try {
    const url = new URL(imageUrl, OWNED_IMAGE_PREFIX)
    if (url.origin === OWNED_IMAGE_PREFIX && !url.search && !url.hash) {
      const match = url.pathname.match(/^\/catalog\/necklaces-optimized\/(celebration-necklace-(?:00[1-9]|01\d|02[0-2]))-(?:thumb|main|zoom)\.webp$/)
      if (match) return `/catalog/necklaces/${match[1]}.png`
    }
  } catch { /* Fall back to existing exact-source checks below. */ }
  const r2Alternate = ownedR2ImageFallback(imageUrl)
  if (r2Alternate) return r2Alternate
  if (!legacyFallback) return undefined
  try {
    const url = new URL(legacyFallback, OWNED_IMAGE_PREFIX)
    if (url.origin !== OWNED_IMAGE_PREFIX || !url.pathname.startsWith("/catalog/")) return undefined
    return url.pathname + url.search
  } catch {
    return undefined
  }
}
