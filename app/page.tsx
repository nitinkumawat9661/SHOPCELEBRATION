import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import { routes } from "../config/routes"
import { Storefront } from "../features/home/Storefront"
import { defaultCatalog } from "../lib/domain/catalog"
import { getCatalogConfig } from "../lib/server/catalog"
import { getTierPopularity } from "../lib/server/orders"
import { defaultStoreSettings, getStoreSettings } from "../lib/server/store-settings"

export const dynamic = "force-dynamic"

const getCachedCatalog = unstable_cache(
  () => getCatalogConfig(),
  ["celebration-home-catalog"],
  { revalidate: 30 }
)

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

  const [catalogResult, proofResult, settingsResult] = await Promise.all([
    getCachedCatalog().catch(() => null),
    getCachedTierPopularity().catch(() => null),
    getCachedStoreSettings().catch(() => null)
  ])

  const catalog = catalogResult?.catalog || defaultCatalog
  const socialProof = proofResult || null
  const settings = settingsResult?.settings || defaultStoreSettings

  return <Storefront initialCatalog={catalog} initialSocialProof={socialProof} initialSettings={settings} />
}
