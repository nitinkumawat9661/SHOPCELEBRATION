"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BudgetSection } from "../catalog/BudgetSection"
import { OccasionRail } from "../catalog/OccasionRail"
import { AmbientMotion } from "../motion/AmbientMotion"
import { SiteHeader } from "../shell/SiteHeader"
import { TrustStrip } from "../shell/TrustStrip"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { Hero } from "./Hero"
import { LazyStorefrontTail } from "./LazyStorefrontTail"

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

type BuilderRequest = {
  active: boolean
  step: number
  version: number
}

function firstTierId(catalog: CatalogConfig) {
  return catalog.tiers.find((item) => item.active !== false)?.id || catalog.settings.defaultTierId
}

function validOccasion(catalog: CatalogConfig) {
  return catalog.occasions.includes(catalog.settings.defaultOccasion)
    ? catalog.settings.defaultOccasion
    : (catalog.occasions[0] || "")
}

function trackLater(eventName: "storefront_view" | "budget_selected" | "builder_started", tierId?: string) {
  if (typeof window === "undefined") return
  void import("../analytics/conversion").then(({ trackConversion }) => {
    trackConversion(eventName, tierId ? { tierId } : {})
  }).catch(() => undefined)
}

export function Storefront({ initialCatalog, initialSocialProof = null }: StorefrontProps) {
  const tiers = useMemo(() => initialCatalog.tiers.filter((item) => item.active !== false), [initialCatalog])
  const products = useMemo(() => initialCatalog.products.filter((item) => item.active !== false), [initialCatalog])
  const [selectedTierId, setSelectedTierId] = useState(() => {
    const configured = tiers.find((item) => item.id === initialCatalog.settings.defaultTierId)
    return configured?.id || firstTierId(initialCatalog)
  })
  const [occasion, setOccasion] = useState(() => validOccasion(initialCatalog))
  const [builderRequest, setBuilderRequest] = useState<BuilderRequest>({ active: false, step: 1, version: 0 })

  useEffect(() => {
    const timer = window.setTimeout(() => trackLater("storefront_view"), 3200)
    return () => window.clearTimeout(timer)
  }, [])

  const goBuilder = useCallback((step = 1) => {
    setBuilderRequest((current) => ({ active: true, step, version: current.version + 1 }))
    trackLater("builder_started", selectedTierId)
  }, [selectedTierId])

  const pickTier = useCallback((id: string) => {
    setSelectedTierId(id)
    trackLater("budget_selected", id)
    setBuilderRequest((current) => ({ active: true, step: 2, version: current.version + 1 }))
    trackLater("builder_started", id)
  }, [])

  const pickOccasion = useCallback((value: string) => {
    setOccasion(value)
    setBuilderRequest((current) => ({ active: true, step: 1, version: current.version + 1 }))
    trackLater("builder_started", selectedTierId)
  }, [selectedTierId])

  const syncSelection = useCallback((tierId: string, nextOccasion: string) => {
    setSelectedTierId((current) => current === tierId ? current : tierId)
    setOccasion((current) => current === nextOccasion ? current : nextOccasion)
  }, [])

  return (
    <main className="storefrontMotionRoot">
      <AmbientMotion />
      <div className="storefrontMotionContent">
        <TrustStrip />
        <SiteHeader onCreate={() => goBuilder(1)} />
        <Hero onBuild={() => goBuilder(1)} tiers={tiers} products={products} />
        <OccasionRail value={occasion} occasions={initialCatalog.occasions} onChange={pickOccasion} />
        <BudgetSection tiers={tiers} selectedTierId={selectedTierId} recommendedTierId={initialCatalog.settings.defaultTierId} socialProof={initialSocialProof} onSelect={pickTier} />
        <LazyStorefrontTail
          catalog={initialCatalog}
          socialProof={initialSocialProof}
          selectedTierId={selectedTierId}
          occasion={occasion}
          builderActive={builderRequest.active}
          requestedStep={builderRequest.step}
          requestVersion={builderRequest.version}
          onBuild={goBuilder}
          onSelectionSync={syncSelection}
        />
      </div>
    </main>
  )
}
