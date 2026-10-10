import type { MetadataRoute } from "next"
import { getCatalogConfig } from "../lib/server/catalog"

const base = "https://shopcelebration.in"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jewelry`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/claim`, lastModified: now, changeFrequency: "monthly", priority: 0.5 }
  ]
  const catalog = await getCatalogConfig().catch(() => null)
  const products: MetadataRoute.Sitemap = (catalog?.catalog.products || [])
    .filter((product) => product.active !== false)
    .map((product) => ({
      url: `${base}/jewelry/${encodeURIComponent(product.id)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: product.sellIndividually ? 0.8 : 0.6
    }))
  return [...staticPages, ...products]
}
