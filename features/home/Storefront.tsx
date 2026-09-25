import type { CatalogConfig } from "../../lib/domain/catalog"
import { AmbientMotion } from "../motion/AmbientMotion"
import { SiteHeader } from "../shell/SiteHeader"
import { TrustStrip } from "../shell/TrustStrip"
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
}

export function Storefront({ initialCatalog, initialSocialProof = null }: StorefrontProps) {
  const tiers = initialCatalog.tiers.filter((item) => item.active !== false)
  const products = initialCatalog.products.filter((item) => item.active !== false)

  return (
    <main className="storefrontMotionRoot">
      <AmbientMotion />
      <div className="storefrontMotionContent">
        <TrustStrip />
        <SiteHeader builderTrigger />
        <Hero tiers={tiers} products={products} />
        <StorefrontDiscovery initialCatalog={initialCatalog} initialSocialProof={initialSocialProof} />
      </div>
    </main>
  )
}
