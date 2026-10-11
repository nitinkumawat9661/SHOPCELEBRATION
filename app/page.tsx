import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import { routes } from "../config/routes"
import { Storefront } from "../features/home/Storefront"
import { defaultCatalog } from "../lib/domain/catalog"
import { getCatalogConfig } from "../lib/server/catalog"
import { getHomeCategoryMedia } from "../lib/server/home-category-media"
import { withVerifiedStorefrontBadges } from "../lib/server/product-badge-evidence"
import { getTierPopularity } from "../lib/server/orders"
import { defaultStoreSettings, getStoreSettings } from "../lib/server/store-settings"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: { absolute: "Celebration | Affordable Jewelry & Custom Gift Hampers Online" },
  description: "Shop affordable jewelry, anti-tarnish pieces marked with a 6-month guarantee, and custom gift hampers from Celebration. Secure online payment, live stock checks and order tracking.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Celebration",
    title: "Celebration | Affordable Jewelry & Custom Gift Hampers Online",
    description: "Affordable jewelry and custom gift hampers with secure checkout, live stock checks and order tracking.",
    images: [{ url: "/images/campaign/jewelry-1600.webp", width: 1600, height: 900, alt: "Celebration jewelry and gifting collection" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Celebration | Affordable Jewelry & Custom Gift Hampers Online",
    description: "Shop affordable jewelry and thoughtful custom gift hampers online.",
    images: ["/images/campaign/jewelry-1600.webp"]
  }
}

const getCachedTierPopularity = unstable_cache(
  () => getTierPopularity(),
  ["celebration-home-tier-popularity"],
  { revalidate: 30 }
)

const getCachedStoreSettings = unstable_cache(
  () => getStoreSettings(),
  ["celebration-home-store-settings"],
  { revalidate: 60 }
)

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const paymentReturn = Array.isArray(params.payment_return) ? params.payment_return[0] : params.payment_return
  const rawOrderId = Array.isArray(params.order_id) ? params.order_id[0] : params.order_id
  const providerOrderId = rawOrderId?.trim() || ""

  if (paymentReturn === "1" && providerOrderId) {
    redirect(`${routes.paymentReturn}?provider_order_id=${encodeURIComponent(providerOrderId)}`)
  }

  const [catalogResult, proofResult, settingsResult, categoryMedia] = await Promise.all([
    getCatalogConfig().catch(() => null),
    getCachedTierPopularity().catch(() => null),
    getCachedStoreSettings().catch(() => null),
    getHomeCategoryMedia().catch(() => ({}))
  ])

  const catalog = catalogResult?.catalog
    ? await withVerifiedStorefrontBadges(catalogResult.catalog)
    : defaultCatalog
  const socialProof = proofResult || null
  const settings = settingsResult?.settings || defaultStoreSettings

  return <Storefront initialCatalog={catalog} initialSocialProof={socialProof} initialSettings={settings} initialCategoryMedia={categoryMedia} />
}
