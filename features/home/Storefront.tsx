import type { CatalogConfig } from "../../lib/domain/catalog"
import type { StoreSettings } from "../../lib/server/store-settings"
import { StorefrontHeader } from "../shell/StorefrontHeader"
import { StoreIcon } from "../shell/StoreIcon"
import { HomeCatalog } from "./HomeCatalog"
import { Hero } from "./Hero"
import { StorefrontDiscovery } from "./StorefrontDiscovery"

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

type StorefrontProps = {
  initialCatalog: CatalogConfig
  initialSocialProof?: TierSocialProof | null
  initialSettings: StoreSettings
}

export function Storefront({ initialCatalog, initialSocialProof = null, initialSettings }: StorefrontProps) {
  const tiers = initialCatalog.tiers.filter((item) => item.active !== false)

  return (
    <div className="celebrationHome">
        <div className="celebrationAnnouncement">Thoughtfully chosen. Beautifully wrapped. <span>Made for their moment.</span></div>
        <StorefrontHeader settings={initialSettings} />
      <main id="main-content">
        <Hero tiers={tiers} />
        <div className="celebrationBenefits wrap" aria-label="The Celebration promise">
          <div><StoreIcon name="box" /><span><b>Beautifully packed</b><small>Made to feel personal</small></span></div>
          <div><StoreIcon name="video" /><span><b>See it before dispatch</b><small>Your hamper, on video</small></span></div>
          <div><StoreIcon name="shield" /><span><b>Clear payment</b><small>Verified confirmation</small></span></div>
          <div><StoreIcon name="track" /><span><b>Follow every moment</b><small>Track your order online</small></span></div>
        </div>
        <HomeCatalog catalog={initialCatalog} />
        <StorefrontDiscovery initialCatalog={initialCatalog} initialSocialProof={initialSocialProof} />
      </main>
    </div>
  )
}
