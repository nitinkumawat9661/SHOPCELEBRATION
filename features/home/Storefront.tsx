import type { CatalogConfig } from "../../lib/domain/catalog"
import type { StoreSettings } from "../../lib/server/store-settings"
import { StorefrontHeader } from "../shell/StorefrontHeader"
import { TrustStrip } from "../shell/TrustStrip"
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
        <TrustStrip />
        <StorefrontHeader settings={initialSettings} />
      <main id="main-content">
        <Hero tiers={tiers} />
        <div className="celebrationBenefits wrap" aria-label="Shopping at Celebration">
          <div><StoreIcon name="box" /><span><b>Prepared for dispatch</b><small>Order updates as we pack</small></span></div>
          <div><StoreIcon name="video" /><span><b>Hamper packing preview</b><small>Where a video is provided</small></span></div>
          <div><StoreIcon name="shield" /><span><b>Payment confirmation</b><small>Check your order status</small></span></div>
          <div><StoreIcon name="track" /><span><b>Track your order</b><small>Updates and courier details</small></span></div>
        </div>
        {initialSocialProof && initialSocialProof.totalOrders >= 20 && initialSocialProof.orderCount >= 5 && initialSocialProof.sharePercent >= 20 && (
          <div className="celebrationRealProof wrap" aria-label="Verified hamper order insight">
            <span>From confirmed hamper orders</span>
            <p>{initialSocialProof.sharePercent}% of {initialSocialProof.totalOrders} paid Celebration hamper orders chose the {initialSocialProof.tierName} budget.</p>
          </div>
        )}
        <HomeCatalog catalog={initialCatalog} />
        <StorefrontDiscovery initialCatalog={initialCatalog} initialSocialProof={initialSocialProof} />
      </main>
    </div>
  )
}
