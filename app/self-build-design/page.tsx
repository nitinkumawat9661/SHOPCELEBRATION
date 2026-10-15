import type { Metadata } from "next"
import { defaultCatalog, visibleTiers } from "../../lib/domain/catalog"
import { getSelfBuildPublishedCatalog } from "../../lib/server/self-build-published-tiers"
import { getStoreSettings, defaultStoreSettings } from "../../lib/server/store-settings"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SelfBuildThreeScreenPreview } from "../../features/builder/SelfBuildThreeScreenPreview"
import "../../styles/self-build-three-screen-preview-20261015.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Self-Build Hamper Design Preview | Celebration",
  description: "Design preview of Celebration's choose-box, choose-gifts, and review flow. Checkout is not enabled.",
  robots: { index: false, follow: false }
}

export default async function SelfBuildDesignPage() {
  const [settingsResult, published] = await Promise.all([
    getStoreSettings().catch(() => null),
    getSelfBuildPublishedCatalog().catch(() => null)
  ])
  const hasPublishedPricing = Boolean(published?.tiers.length)
  return <main className="celebrationHome sb3PreviewPage">
    <TrustStrip />
    <StorefrontHeader settings={settingsResult?.settings || defaultStoreSettings} />
    <SelfBuildThreeScreenPreview
      tiers={hasPublishedPricing ? published!.tiers : visibleTiers(defaultCatalog)}
      hasPublishedPricing={hasPublishedPricing}
    />
    <SiteFooter />
  </main>
}
