"use client"

import { useEffect, useRef } from "react"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { LazyHamperBuilder } from "../builder/LazyHamperBuilder"
import { useHamperBuilder } from "../builder/useHamperBuilder"
import { SiteFooter } from "../shell/SiteFooter"
import { UxMessenger } from "../ux/UxMessenger"
import { CustomRequestSection } from "./CustomRequestSection"
import { FinalCta } from "./FinalCta"
import { PromiseSection } from "./PromiseSection"

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
  quickStart,
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
  quickStart: boolean
  requestVersion: number
  onBuild: (step?: number) => void
  onSelectionSync: (tierId: string, occasion: string) => void
}) {
  const state = useHamperBuilder({ catalog, socialProof, tierId: selectedTierId, occasion })

  // A new homepage click is authoritative. Until the builder has loaded its
  // saved draft AND applied the requested tier/occasion, do not echo a stale
  // default/draft back to the homepage. Previously selecting "Anniversary"
  // could be immediately overwritten by the old "Birthday" selection.
  const pendingRequest = useRef<{ tierId: string; occasion: string } | null>(null)

  useEffect(() => {
    if (!builderActive) return
    pendingRequest.current = { tierId: selectedTierId, occasion }
    if (!state.draftReady) return

    if (selectedTierId && selectedTierId !== state.tierId) state.selectTier(selectedTierId)
    if (occasion && occasion !== state.checkout.occasion) state.updateField("occasion", occasion)
    state.setStep(Math.min(3, Math.max(1, requestedStep)))
    const timer = window.setTimeout(() => {
      document.getElementById("builder")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })
    }, 80)
    return () => window.clearTimeout(timer)
    // Changes to requestVersion and initial draft readiness represent a new
    // *external* builder selection. Internal builder edits still sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestVersion, state.draftReady])

  useEffect(() => {
    const pending = pendingRequest.current
    if (pending) {
      if (state.tierId !== pending.tierId || state.checkout.occasion !== pending.occasion) return
      pendingRequest.current = null
    }
    onSelectionSync(state.tierId, state.checkout.occasion)
  }, [state.tierId, state.checkout.occasion, onSelectionSync])

  return (
    <>
      <UxMessenger />
      <LazyHamperBuilder state={state} active={builderActive} quickStart={quickStart} />
      <PromiseSection />
      <CustomRequestSection />
      <FinalCta onBuild={() => onBuild(1)} />
      <SiteFooter />
    </>
  )
}
