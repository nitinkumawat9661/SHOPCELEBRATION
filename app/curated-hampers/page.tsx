import type { Metadata } from "next"
import { defaultCatalog } from "../../lib/domain/catalog"
import { getCatalogConfig } from "../../lib/server/catalog"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { UxMessenger } from "../../features/ux/UxMessenger"
import { CuratedHamperFlow } from "../../features/builder/CuratedHamperFlow"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Celebration Curated Hampers | Choose a Budget & Occasion",
  description: "Choose your budget and occasion. Celebration curates the complete gift hamper, with delivery details and secure checkout.",
  alternates: { canonical: "/curated-hampers" }
}

export default async function CuratedHampersPage() {
  const [catalogResult, settingsResult] = await Promise.all([
    getCatalogConfig().catch(() => null),
    getStoreSettings().catch(() => null)
  ])
  const catalog = catalogResult?.catalog || defaultCatalog
  const settings = settingsResult?.settings || defaultStoreSettings

  return <div className="celebrationHome curatedFlowPage">
    <TrustStrip />
    <StorefrontHeader settings={settings} />
    <main id="main-content">
      <CuratedHamperFlow catalog={catalog} />
    </main>
    <SiteFooter />
    <UxMessenger />
  </div>
}
