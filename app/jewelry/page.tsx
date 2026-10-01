import type { Metadata } from "next"
import { CatalogCollection } from "../../features/catalog/CatalogCollection"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { getCatalogConfig } from "../../lib/server/catalog"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Jewelry & Gifts | Celebration", description: "Discover thoughtful jewelry and gifts for your Celebration hamper. Explore the collection and choose a budget for your occasion." }

export default async function JewelryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, catalog, settings] = await Promise.all([searchParams, getCatalogConfig().catch(() => null), getStoreSettings().catch(() => null)])
  const value = (key: string) => (typeof params[key] === "string" ? params[key] : "").slice(0, 100)
  return <main className="collectionPage"><TrustStrip /><StorefrontHeader settings={settings?.settings || defaultStoreSettings} /><CatalogCollection products={catalog?.catalog.products || []} available={Boolean(catalog)} filters={{ view: value("view"), q: value("q"), category: value("category"), sort: value("sort") }} /><SiteFooter /></main>
}
