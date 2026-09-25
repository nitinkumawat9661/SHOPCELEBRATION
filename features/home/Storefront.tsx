"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { BudgetSection } from "../catalog/BudgetSection"
import { OccasionRail } from "../catalog/OccasionRail"
import { ProductSection } from "../catalog/ProductSection"
import { useHamperBuilder } from "../builder/useHamperBuilder"
import { AmbientMotion } from "../motion/AmbientMotion"
import { Hero } from "./Hero"
import { SiteFooter } from "../shell/SiteFooter"
import { SiteHeader } from "../shell/SiteHeader"
import { TrustStrip } from "../shell/TrustStrip"
import { notifyUx } from "../ux/UxMessenger"
import { trackConversion } from "../analytics/conversion"
import { formatMoney } from "../../lib/domain/catalog"

const ProofAndReviews = dynamic(() => import("./ProofAndReviews").then((mod) => mod.ProofAndReviews), { ssr: false })
const CustomRequestSection = dynamic(() => import("./CustomRequestSection").then((mod) => mod.CustomRequestSection), { ssr: false })
const HamperBuilder = dynamic(() => import("../builder/HamperBuilder").then((mod) => mod.HamperBuilder), { ssr: false })
const PromiseSection = dynamic(() => import("./PromiseSection").then((mod) => mod.PromiseSection), { ssr: false })
const FinalCta = dynamic(() => import("./FinalCta").then((mod) => mod.FinalCta), { ssr: false })

type DeferredBlockProps = {
  children: ReactNode
  minHeight: number
  force?: boolean
  anchorId?: string
}

function DeferredBlock({ children, minHeight, force = false, anchorId }: DeferredBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(force)

  useEffect(() => {
    if (force) {
      setReady(true)
      return
    }
    if (ready || !ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setReady(true)
      observer.disconnect()
    }, { rootMargin: "320px 0px" })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [force, ready])

  return (
    <div ref={ref} id={anchorId} className="deferredStorefrontBlock" style={ready ? undefined : { minHeight }}>
      {ready ? children : null}
    </div>
  )
}

export function Storefront() {
  const state = useHamperBuilder()
  const [builderForced, setBuilderForced] = useState(false)

  useEffect(() => { trackConversion("storefront_view") }, [])

  function goBuilder(step = 1) {
    state.setStep(step)
    setBuilderForced(true)
    trackConversion("builder_started", { tierId: state.tierId })
    requestAnimationFrame(() => {
      document.getElementById("builder-shell")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
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
        <ProductSection products={state.products} categories={state.categories} allCategoryId={state.catalog.settings.allCategory.id} category={state.category} onCategory={state.setCategory} />
        <DeferredBlock minHeight={480}><ProofAndReviews socialProof={state.socialProof} /></DeferredBlock>
        <DeferredBlock minHeight={520}><CustomRequestSection /></DeferredBlock>
        <DeferredBlock minHeight={760} force={builderForced} anchorId="builder-shell"><HamperBuilder state={state} /></DeferredBlock>
        <DeferredBlock minHeight={420}><PromiseSection /></DeferredBlock>
        <DeferredBlock minHeight={300}><FinalCta onBuild={() => goBuilder(1)} /></DeferredBlock>
        <SiteFooter />
      </div>
    </main>
  )
}
