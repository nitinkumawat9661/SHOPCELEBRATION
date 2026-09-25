"use client"

import { useEffect, useState } from "react"
import { BudgetSection } from "../catalog/BudgetSection"
import { OccasionRail } from "../catalog/OccasionRail"
import { useHamperBuilder, type TierSocialProof } from "../builder/useHamperBuilder"
import { AmbientMotion } from "../motion/AmbientMotion"
import { SiteHeader } from "../shell/SiteHeader"
import { TrustStrip } from "../shell/TrustStrip"
import { notifyUx } from "../ux/UxMessenger"
import { trackConversion } from "../analytics/conversion"
import { formatMoney, type CatalogConfig } from "../../lib/domain/catalog"
import { Hero } from "./Hero"
import { LazyStorefrontTail } from "./LazyStorefrontTail"

type StorefrontProps = {
  initialCatalog?: CatalogConfig
  initialSocialProof?: TierSocialProof | null
}

export function Storefront({ initialCatalog, initialSocialProof = null }: StorefrontProps) {
  const state = useHamperBuilder({ catalog: initialCatalog, socialProof: initialSocialProof })
  const [builderActive, setBuilderActive] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => trackConversion("storefront_view"), 2200)
    return () => window.clearTimeout(timer)
  }, [])

  function goBuilder(step = 1) {
    state.setStep(step)
    setBuilderActive(true)
    trackConversion("builder_started", { tierId: state.tierId })
    window.setTimeout(() => document.getElementById("builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30)
  }

  function pickTier(id: string) {
    const picked = state.tiers.find((item) => item.id === id)
    state.selectTier(id)
    trackConversion("budget_selected", { tierId: id })
    if (picked) notifyUx({ title: `${formatMoney(picked.price)} selected`, body: "Now pick the gifts that fit this budget.", tone: "info", durationMs: 2400 })
    goBuilder(2)
  }

  function pickOccasion(value: string) {
    state.updateField("occasion", value)
    notifyUx({ title: `${value} selected`, body: "Great — now choose a budget.", tone: "info", durationMs: 2200 })
    goBuilder(1)
  }

  return (
    <main className="storefrontMotionRoot">
      <AmbientMotion />
      <div className="storefrontMotionContent">
        <TrustStrip />
        <SiteHeader onCreate={() => goBuilder(1)} />
        <Hero onBuild={() => goBuilder(1)} tiers={state.tiers} products={state.products} />
        <OccasionRail value={state.checkout.occasion} occasions={state.occasions} onChange={pickOccasion} />
        <BudgetSection tiers={state.tiers} selectedTierId={state.tierId} recommendedTierId={state.catalog.settings.defaultTierId} socialProof={state.socialProof} onSelect={pickTier} />
        <LazyStorefrontTail state={state} builderActive={builderActive} onBuild={goBuilder} />
      </div>
    </main>
  )
}
