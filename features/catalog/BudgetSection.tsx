"use client"

import { useRef } from "react"
import type { Tier } from "../../lib/domain/catalog"
import { uiContent } from "../../lib/domain/content"
import { formatMoney } from "../../lib/domain/money"

const UNSUPPORTED_SOCIAL_PROOF = new Set(["POPULAR", "BESTSELLER", "MOST POPULAR", "CUSTOMER FAVORITE", "CUSTOMER FAVOURITE"])

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

function tierBadge(item: Tier, recommendedTierId: string, socialProof: TierSocialProof | null) {
  if (socialProof && item.name === socialProof.tierName) return "MOST CHOSEN"
  if (item.id === recommendedTierId) return "RECOMMENDED"
  const label = item.label?.trim()
  if (!label || UNSUPPORTED_SOCIAL_PROOF.has(label.toUpperCase())) return ""
  return label
}

export function BudgetSection({ tiers, selectedTierId, hasChosenTier, recommendedTierId, socialProof, onSelect }: { tiers: Tier[]; selectedTierId: string; hasChosenTier: boolean; recommendedTierId: string; socialProof: TierSocialProof | null; onSelect: (id: string) => void }) {
  const railRef = useRef<HTMLDivElement>(null)
  const startingPrice = tiers.length ? Math.min(...tiers.map((tier) => tier.price)) : null

  function moveRail(direction: -1 | 1) {
    const rail = railRef.current
    if (!rail) return
    const card = rail.querySelector<HTMLElement>(".tier")
    const distance = card ? card.getBoundingClientRect().width + 16 : rail.clientWidth * 0.75
    rail.scrollBy({ left: direction * Math.max(distance, 120), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  }

  return (
    <section id="budgets" className="celebrationBudgets">
      <div className="wrap">
        <div className="sectionHead">
          <div className="celebrationBudgetIntro">
            <div className="kicker">{uiContent.budgets.kicker}</div>
            <h2>{uiContent.budgets.title}</h2>
            {startingPrice !== null && <span className="celebrationBudgetStarting">Complete hampers from <strong>{formatMoney(startingPrice)}</strong></span>}
          </div>
          <p>{uiContent.budgets.body}</p>
        </div>
        <div className="celebrationBudgetBrowseHead">
          <span className="celebrationBudgetBrowseCount">{tiers.length} {tiers.length === 1 ? "budget" : "budgets"} to explore</span>
          <span className="celebrationBudgetSwipeHint">Swipe to see more <span aria-hidden="true">→</span></span>
          {tiers.length > 3 && <div className="celebrationBudgetArrows" aria-label="Browse hamper budgets">
            <button type="button" aria-label="Previous hamper budgets" onClick={() => moveRail(-1)}>←</button>
            <button type="button" aria-label="Next hamper budgets" onClick={() => moveRail(1)}>→</button>
          </div>}
        </div>
        <div className="tiers" ref={railRef} role="region" aria-label="Choose a complete hamper budget" tabIndex={0}>
          {tiers.map((item) => {
            const badge = tierBadge(item, recommendedTierId, socialProof)
            return (
              <button type="button" key={item.id} className={`tier ${hasChosenTier && selectedTierId === item.id ? "active" : ""}`} aria-pressed={hasChosenTier && selectedTierId === item.id} onClick={() => onSelect(item.id)}>
                <div className="celebrationTierMeta">
                  <span className="celebrationTierEyebrow">MAKE IT PERSONAL</span>
                  {badge && <span className="badge">{badge}</span>}
                </div>
                <div className="price">{formatMoney(item.price)}</div>
                <div className="name">{item.name}</div>
                <div className="celebrationTierDetails">
                  <span className="size">{item.size}</span>
                  <span className="celebrationTierDivider" aria-hidden="true" />
                  <span>Up to {item.maxChoices} {item.maxChoices === 1 ? "choice" : "choices"}</span>
                </div>
                <div className="note">Price for the complete hamper</div>
                <span className="celebrationTierCta"><span>{hasChosenTier && selectedTierId === item.id ? "Selected" : "Choose this hamper"}</span><span className="celebrationTierArrow" aria-hidden="true">→</span></span>
              </button>
            )
          })}
        </div>
        <div className="budgetDecisionHint">
          <div><b>Working with a different budget?</b><span>Tell us your amount and the occasion. We’ll review the request before you place an order.</span></div>
          <a className="secondary" href="#custom-request">Request a custom budget</a>
        </div>
      </div>
    </section>
  )
}
