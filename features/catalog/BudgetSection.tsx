"use client"

import type { Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
import { HAMPER_DELIVERY_FEE_PAISE } from "../../config/self-build-delivery"

const HOMEPAGE_TIER_ORDER = ["t299", "t399", "t499", "t699", "t999", "t1499", "t2499", "t5000"]

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

export function BudgetSection({ tiers, selectedTierId, hasChosenTier, recommendedTierId, socialProof, onSelect }: {
  tiers: Tier[]
  selectedTierId: string
  hasChosenTier: boolean
  recommendedTierId: string
  socialProof: TierSocialProof | null
  onSelect: (id: string) => void
}) {
  const featured = HOMEPAGE_TIER_ORDER
    .map((id) => tiers.find((item) => item.id === id))
    .filter((item): item is Tier => !!item)

  const totalDelivery = HAMPER_DELIVERY_FEE_PAISE / 100

  return (
    <section id="budgets" className="celebrationBudgets cbBudgetSection">
      <div className="wrap">
        <div className="cbSectionHeading">
          <span className="cbEyebrow">THOUGHTFUL AT EVERY BUDGET</span>
          <h2>Choose your budget</h2>
          <p>You choose the budget. We curate the gift mix and presentation.</p>
        </div>
        <div className="cbBudgetGrid" role="region" aria-label="Choose a Celebration hamper budget">
          {featured.map((item) => {
            const chosen = hasChosenTier && selectedTierId === item.id
            const mostChosen = socialProof && item.name === socialProof.tierName
            const recommended = item.id === recommendedTierId
            return (
              <button type="button" key={item.id} id={`hamper-${item.id}`} className={`cbBudgetCard ${chosen ? "isChosen" : ""}`} aria-pressed={chosen} onClick={() => onSelect(item.id)}>
                <span className="cbBudgetCardTop">
                  <span className="cbCardKicker">CELEBRATION HAMPER</span>
                  {mostChosen ? <span className="cbBadge">Most chosen</span> : recommended ? <span className="cbBadge">Recommended</span> : null}
                </span>
                <strong className="cbBudgetPrice">{formatMoney(item.price)}</strong>
                <span className="cbBudgetName">{item.name}</span>
                <span className="cbBudgetSize">{item.size}</span>
                <span className="cbBudgetFee">+ {formatMoney(totalDelivery)} delivery · Total {formatMoney(item.price + totalDelivery)}</span>
                <span className="cbPrimaryBtn">{chosen ? "Selected" : "Choose this hamper"} <span aria-hidden="true">→</span></span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
