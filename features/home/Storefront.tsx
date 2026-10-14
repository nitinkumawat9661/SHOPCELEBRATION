import type { CatalogConfig } from "../../lib/domain/catalog"
import { isPublicHamperOrderProof } from "../../lib/domain/real-social-proof"
import type { StoreSettings } from "../../lib/server/store-settings"
import { StorefrontHeader } from "../shell/StorefrontHeader"
import { TrustStrip } from "../shell/TrustStrip"
import { BalancedHomepage } from "./BalancedHomepage"
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
  initialCategoryMedia: Record<string, string>
  initialSelfBuildEnabled?: boolean
}

export function Storefront({ initialCatalog, initialSocialProof = null, initialSettings, initialCategoryMedia, initialSelfBuildEnabled = false }: StorefrontProps) {
  const tiers = initialCatalog.tiers.filter((item) => item.active !== false)
  const visibleProof = isPublicHamperOrderProof(initialSocialProof, tiers) ? initialSocialProof : null

  return (
    <div className="celebrationHome celebrationBalancedHome">
      <TrustStrip />
      <StorefrontHeader settings={initialSettings} showSelfBuild={initialSelfBuildEnabled} />
      <div className="celebrationHomeHeaderSpacer" aria-hidden="true" />
      <main id="main-content">
        <BalancedHomepage catalog={initialCatalog} categoryMedia={initialCategoryMedia} selfBuildEnabled={initialSelfBuildEnabled} />
        <StorefrontDiscovery initialCatalog={initialCatalog} initialSocialProof={visibleProof} />
      </main>
    </div>
  )
}
