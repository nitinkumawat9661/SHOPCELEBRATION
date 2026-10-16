import type { MetadataRoute } from "next"
import { getCatalogConfig } from "../lib/server/catalog"

const base = "https://shopcelebration.in"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Omit lastmod until real per-product edit dates can be supplied.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jewelry`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/claim`, changeFrequency: "monthly", priority: 0.5 }
  ]
  const catalog = await getCatalogConfig().catch(() => null)
  const products: MetadataRoute.Sitemap = (catalog?.catalog.products || [])
    .filter((product) => product.active !== false)
    .map((product) => ({
      url: `${base}/jewelry/${encodeURIComponent(product.id)}`,
      changeFrequency: "weekly" as const,
      priority: product.sellIndividually ? 0.8 : 0.6
    }))
  return [...staticPages, ...products]
}
