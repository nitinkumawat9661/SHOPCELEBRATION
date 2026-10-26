import type { MetadataRoute } from "next"
import { catalogImageVariant, primaryProductImage } from "../lib/domain/catalog"
import { isJewelryProduct } from "../lib/domain/catalog-discovery"
import { jewelrySeoCategories } from "../lib/domain/jewelry-seo-categories"
import { getPublicCatalogConfig } from "../lib/server/public-storefront"

// Admin publishes products directly to PostgreSQL, not through a code deploy.
// Force a fresh route evaluation so newly published SKUs appear in the sitemap
// without waiting for a new Next.js build (catalog snapshot TTL: eight seconds).
export const dynamic = "force-dynamic"
const base = "https://shopcelebration.in"

/** A sitemap image must be public and owned by Celebration, never an external
 * source URL or a customer's private photo. Existing WebPs keep the same SKU. */
function publicProductImage(url: string | undefined): string | undefined {
  if (!url) return undefined
  const variant = catalogImageVariant(url, "main")
  if (variant.startsWith("/") && !variant.startsWith("//")) return `${base}${variant}`
  if (variant.startsWith(`${base}/`)) return variant
  return undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Never list noindex pages (/policies, /terms, /privacy, account, payments).
  // /curated-hampers has a public self-canonical and is part of the storefront.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jewelry`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/curated-hampers`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/claim`, changeFrequency: "monthly", priority: 0.5 }
  ]
  // Do not respond with a successful, incomplete sitemap during a DB outage.
  // Google can retry a 5xx; a partial 200 incorrectly removes every product URL.
  const { catalog } = await getPublicCatalogConfig()
  const active = catalog.products.filter((product) => product.active !== false)
  const categoryPages: MetadataRoute.Sitemap = jewelrySeoCategories
    .filter((category) => active.some((product) => product.category === category.name && isJewelryProduct(product)))
    .map((category) => ({
      url: `${base}/jewelry/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75
    }))
  const seen = new Set<string>()
  const products: MetadataRoute.Sitemap = active
    .filter((product) => {
      if (typeof product.id !== "string" || !product.id.trim() || seen.has(product.id)) return false
      seen.add(product.id)
      return true
    })
    .map((product) => {
      const image = publicProductImage(primaryProductImage(product)?.url)
      return {
        url: `${base}/jewelry/${encodeURIComponent(product.id)}`,
        changeFrequency: "weekly" as const,
        priority: product.sellIndividually ? 0.8 : 0.6,
        ...(image ? { images: [image] } : {})
      }
    })
  return [...staticPages, ...categoryPages, ...products]
}
