"use client"

import { useCallback, useEffect, useState } from "react"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { BudgetSection } from "../catalog/BudgetSection"
import { BUILDER_OPEN_EVENT, type BuilderOpenDetail } from "../builder/builder-events"
import { LazyStorefrontTail } from "./LazyStorefrontTail"

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

type BuilderRequest = {
  active: boolean
  step: number
  quickStart: boolean
  version: number
}

function firstTierId(catalog: CatalogConfig) {
  return catalog.tiers.find((item) => item.active !== false)?.id || catalog.settings.defaultTierId
}

function initialOccasion(catalog: CatalogConfig) {
  return catalog.occasions.includes(catalog.settings.defaultOccasion)
    ? catalog.settings.defaultOccasion
    : (catalog.occasions[0] || "")
}

function trackLater(eventName: "budget_selected" | "builder_started", tierId?: string) {
  if (typeof window === "undefined") return
  void import("../analytics/conversion").then(({ trackConversion }) => {
    trackConversion(eventName, tierId ? { tierId } : {})
  }).catch(() => undefined)
}

export function StorefrontDiscovery({ initialCatalog, initialSocialProof = null }: {
  initialCatalog: CatalogConfig
  initialSocialProof?: TierSocialProof | null
}) {
  const tiers = initialCatalog.tiers.filter((item) => item.active !== false)
  const [selectedTierId, setSelectedTierId] = useState(() => {
    const configured = tiers.find((item) => item.id === initialCatalog.settings.defaultTierId)
    return configured?.id || firstTierId(initialCatalog)
  })
  const [occasion, setOccasion] = useState(() => initialOccasion(initialCatalog))
  const [tierChosen, setTierChosen] = useState(false)
  const [builderRequest, setBuilderRequest] = useState<BuilderRequest>({ active: false, step: 1, quickStart: false, version: 0 })

  const openBuilder = useCallback((step = 1, tierId = selectedTierId, quickStart = false) => {
    setBuilderRequest((current) => ({ active: true, step, quickStart, version: current.version + 1 }))
    trackLater("builder_started", tierId)
  }, [selectedTierId])


  useEffect(() => {
    function onBuilderOpen(event: Event) {
      const detail = (event as CustomEvent<BuilderOpenDetail>).detail
      const requested = detail?.tierId && tiers.find((tier) => tier.id === detail.tierId)
      if (requested) {
        setSelectedTierId(requested.id)
        setTierChosen(true)
        setBuilderRequest((current) => ({ active: true, step: detail?.step || 2, quickStart: true, version: current.version + 1 }))
        trackLater("budget_selected", requested.id)
        trackLater("builder_started", requested.id)
      } else {
        openBuilder(detail?.step || 1)
      }
    }
    window.addEventListener(BUILDER_OPEN_EVENT, onBuilderOpen)
    return () => window.removeEventListener(BUILDER_OPEN_EVENT, onBuilderOpen)
  }, [openBuilder])

  function pickTier(id: string) {
    setTierChosen(true)
    setSelectedTierId(id)
    trackLater("budget_selected", id)
    openBuilder(2, id, true)
  }

  const syncSelection = useCallback((tierId: string, nextOccasion: string) => {
    setSelectedTierId((current) => current === tierId ? current : tierId)
    setOccasion((current) => current === nextOccasion ? current : nextOccasion)
  }, [])

  return (
    <>
      <BudgetSection tiers={tiers} selectedTierId={selectedTierId} hasChosenTier={tierChosen} recommendedTierId={initialCatalog.settings.defaultTierId} socialProof={initialSocialProof} onSelect={pickTier} />
      <LazyStorefrontTail
        catalog={initialCatalog}
        socialProof={initialSocialProof}
        selectedTierId={selectedTierId}
        occasion={occasion}
        builderActive={builderRequest.active}
        requestedStep={builderRequest.step}
        quickStart={builderRequest.quickStart}
        requestVersion={builderRequest.version}
        onBuild={openBuilder}
        onSelectionSync={syncSelection}
      />
    </>
  )
}
