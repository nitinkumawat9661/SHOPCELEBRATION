import { unstable_cache } from "next/cache"
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

export default async function HomePage() {
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
