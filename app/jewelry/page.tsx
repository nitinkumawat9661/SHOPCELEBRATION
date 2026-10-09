import type { Metadata } from "next"
import { CatalogCollection } from "../../features/catalog/CatalogCollection"
import { SeoJsonLd } from "../../features/seo/SeoJsonLd"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { primaryProductImage } from "../../lib/domain/catalog"
import { getCatalogConfig } from "../../lib/server/catalog"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"
const siteUrl = "https://shopcelebration.in"

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams
  const filtered = ["q", "category", "sort", "price"].some((key) => typeof params[key] === "string" && String(params[key]).trim())
  const title = "Affordable Jewelry Online: Rings, Necklaces & Bracelets"
  const description = "Shop affordable jewelry online at Celebration, including rings, necklaces, bangles and bracelets. Live stock checks, secure payment, order tracking and delivery included where shown."
  return {
    title,
    description,
    alternates: { canonical: "/jewelry" },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: "/jewelry",
      title: `${title} | Celebration`,
      description,
      images: [{ url: "/images/campaign/jewelry-1600.webp", width: 1600, height: 900, alt: "Celebration jewelry collection" }]
    }
  }
}

export default async function JewelryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, catalog, settings] = await Promise.all([searchParams, getCatalogConfig().catch(() => null), getStoreSettings().catch(() => null)])
  const value = (key: string) => (typeof params[key] === "string" ? params[key] : "").slice(0, 100)
  const products = catalog?.catalog.products.filter((product) => product.active !== false) || []
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Celebration Jewelry & Gifts",
    url: `${siteUrl}/jewelry`,
    description: "Affordable jewelry and gift-ready pieces from Celebration.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 50).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/jewelry/${encodeURIComponent(product.id)}`,
        name: product.name,
        image: (() => {
          const image = primaryProductImage(product)?.url
          if (!image) return undefined
          return image.startsWith("/") ? `${siteUrl}${image}` : image
        })()
      }))
    }
  }
  return <main className="collectionPage">
    <SeoJsonLd data={itemList} />
    <TrustStrip />
    <StorefrontHeader settings={settings?.settings || defaultStoreSettings} searchQuery={value("q")} />
    <CatalogCollection products={catalog?.catalog.products || []} available={Boolean(catalog)} filters={{ view: value("view"), q: value("q"), category: value("category"), sort: value("sort"), price: value("price") }} />
    <SiteFooter />
  </main>
}
