"use client"

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

export function BudgetSection({ tiers, selectedTierId, recommendedTierId, socialProof, onSelect }: { tiers: Tier[]; selectedTierId: string; recommendedTierId: string; socialProof: TierSocialProof | null; onSelect: (id: string) => void }) {
  return (
    <section id="budgets" className="celebrationBudgets">
      <div className="wrap">
        <div className="sectionHead">
          <div><div className="kicker">{uiContent.budgets.kicker}</div><h2>{uiContent.budgets.title}</h2></div>
          <p>{uiContent.budgets.body}</p>
        </div>
        <div className="tiers">
          {tiers.map((item) => {
            const badge = tierBadge(item, recommendedTierId, socialProof)
            return (
              <button type="button" key={item.id} className={`tier ${selectedTierId === item.id ? "active" : ""}`} aria-pressed={selectedTierId === item.id} onClick={() => onSelect(item.id)}>
                {badge && <span className="badge">{badge}</span>}
                <div className="celebrationTierEyebrow">CURATED HAMPER</div>
                <div className="size">{item.size}</div>
                <div className="price">{formatMoney(item.price)}</div>
                <div className="name">{item.name}</div>
                <div className="note">Curated for your occasion</div>
                <span className="celebrationTierCta"><span>{selectedTierId === item.id ? "Selected" : "Choose this hamper"}</span><span className="celebrationTierArrow" aria-hidden="true">→</span></span>
              </button>
            )
          })}
        </div>
        <div className="budgetDecisionHint">
          <div><b>Not sure which one to choose?</b><span>Pick the budget that feels right. Celebration curates the products and presentation inside the hamper.</span></div>
          <a className="secondary" href="#custom-request">Build around my budget</a>
        </div>
      </div>
    </section>
  )
}
