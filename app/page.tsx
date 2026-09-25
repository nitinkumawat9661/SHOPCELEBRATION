import { Storefront } from "../features/home/Storefront"
import { defaultCatalog } from "../lib/domain/catalog"
import { getCatalogConfig } from "../lib/server/catalog"
import { getTierPopularity } from "../lib/server/orders"
import { defaultStoreSettings, getStoreSettings } from "../lib/server/store-settings"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [catalogResult, proofResult, settingsResult] = await Promise.all([
    getCatalogConfig().catch(() => null),
    getTierPopularity().catch(() => null),
    getStoreSettings().catch(() => null)
  ])

  const catalog = catalogResult?.catalog || defaultCatalog
  const socialProof = proofResult || null
  const settings = settingsResult?.settings || defaultStoreSettings

  return <Storefront initialCatalog={catalog} initialSocialProof={socialProof} initialSettings={settings} />
}
