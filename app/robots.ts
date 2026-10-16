import type { MetadataRoute } from "next"
import { publicEnv } from "../config/public-env"

export default function robots(): MetadataRoute.Robots {
  if (!publicEnv.siteIndexable) return { rules: { userAgent: "*", disallow: "/" } }
  return {
    rules: {
      userAgent: "*",
      // Keep the public product-image proxy crawlable while other APIs stay blocked.
      allow: ["/", "/api/catalog/image?key="],
      disallow: ["/admin", "/account", "/cart", "/payment", "/track", "/api"]
    },
    sitemap: "https://shopcelebration.in/sitemap.xml",
    host: "https://shopcelebration.in"
  }
}
