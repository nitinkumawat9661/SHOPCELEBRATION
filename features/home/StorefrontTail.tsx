"use client"

import { useEffect } from "react"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { ProductSection } from "../catalog/ProductSection"
import { LazyHamperBuilder } from "../builder/LazyHamperBuilder"
import { useHamperBuilder } from "../builder/useHamperBuilder"
import { SiteFooter } from "../shell/SiteFooter"
import { CustomRequestSection } from "./CustomRequestSection"
import { FinalCta } from "./FinalCta"
import { PromiseSection } from "./PromiseSection"
import { ProofAndReviews } from "./ProofAndReviews"

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

export function StorefrontTail({
  catalog,
  socialProof,
  selectedTierId,
  occasion,
  builderActive,
  requestedStep,
  requestVersion,
  onBuild,
  onSelectionSync
}: {
  catalog: CatalogConfig
  socialProof: TierSocialProof | null
  selectedTierId: string
  occasion: string
  builderActive: boolean
  requestedStep: number
  requestVersion: number
  onBuild: (step?: number) => void
  onSelectionSync: (tierId: string, occasion: string) => void
}) {
  const state = useHamperBuilder({ catalog, socialProof, tierId: selectedTierId, occasion })

  useEffect(() => {
    if (!builderActive) return
    if (selectedTierId && selectedTierId !== state.tierId) state.selectTier(selectedTierId)
    if (occasion && occasion !== state.checkout.occasion) state.updateField("occasion", occasion)
    state.setStep(Math.min(4, Math.max(1, requestedStep)))
    const timer = window.setTimeout(() => {
      document.getElementById("builder")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
    return () => window.clearTimeout(timer)
    // requestVersion intentionally represents a new top-of-storefront builder request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestVersion])

  useEffect(() => {
    onSelectionSync(state.tierId, state.checkout.occasion)
  }, [state.tierId, state.checkout.occasion, onSelectionSync])

  return (
    <>
      <ProductSection products={state.products} categories={state.categories} allCategoryId={state.catalog.settings.allCategory.id} category={state.category} onCategory={state.setCategory} />
      <ProofAndReviews socialProof={state.socialProof} />
      <CustomRequestSection />
      <LazyHamperBuilder state={state} active={builderActive} />
      <PromiseSection />
      <FinalCta onBuild={() => onBuild(1)} />
      <SiteFooter />
    </>
  )
}
