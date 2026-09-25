"use client"

import { ProductSection } from "../catalog/ProductSection"
import { LazyHamperBuilder } from "../builder/LazyHamperBuilder"
import type { useHamperBuilder } from "../builder/useHamperBuilder"
import { SiteFooter } from "../shell/SiteFooter"
import { CustomRequestSection } from "./CustomRequestSection"
import { FinalCta } from "./FinalCta"
import { PromiseSection } from "./PromiseSection"
import { ProofAndReviews } from "./ProofAndReviews"

type StoreState = ReturnType<typeof useHamperBuilder>

export function StorefrontTail({ state, builderActive, onBuild }: {
  state: StoreState
  builderActive: boolean
  onBuild: (step?: number) => void
}) {
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
