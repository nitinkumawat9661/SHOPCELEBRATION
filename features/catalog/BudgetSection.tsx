"use client"

import type { Tier } from "../../lib/domain/catalog"
import { uiContent } from "../../lib/domain/content"
import { formatMoney } from "../../lib/domain/money"
import { TiltTierButton } from "../motion/InteractiveSurface"

const UNSUPPORTED_SOCIAL_PROOF = new Set(["POPULAR", "BESTSELLER", "MOST POPULAR", "CUSTOMER FAVORITE", "CUSTOMER FAVOURITE"])

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

function valueScore(tier: Tier) {
  return tier.price > 0 ? tier.pointBudget / tier.price : 0
}

function tierBadge(item: Tier, recommendedTierId: string, bestValueId: string, socialProof: TierSocialProof | null) {
  if (socialProof && item.name === socialProof.tierName) return "MOST CHOSEN"
  if (item.id === recommendedTierId) return "RECOMMENDED"
  if (item.id === bestValueId) return "BEST VALUE"
  const label = item.label?.trim()
  if (!label || UNSUPPORTED_SOCIAL_PROOF.has(label.toUpperCase())) return ""
  return label
}

export function BudgetSection({ tiers, selectedTierId, recommendedTierId, socialProof, onSelect }: { tiers: Tier[]; selectedTierId: string; recommendedTierId: string; socialProof: TierSocialProof | null; onSelect: (id: string) => void }) {
  const bestValueId = tiers.reduce((best, item) => valueScore(item) > valueScore(best) ? item : best, tiers[0])?.id || ""

  return (
    <section id="budgets">
      <div className="wrap">
        <div className="sectionHead">
          <div><div className="kicker">{uiContent.budgets.kicker}</div><h2>{uiContent.budgets.title}</h2></div>
          <p>{uiContent.budgets.body}</p>
        </div>
        <div className="tiers">
          {tiers.map((item) => {
            const isMostChosen = Boolean(socialProof && item.name === socialProof.tierName)
            const badge = tierBadge(item, recommendedTierId, bestValueId, socialProof)
            return (
              <TiltTierButton type="button" key={item.id} rotationFactor={11} className={`tier ${selectedTierId === item.id ? "active" : ""}`} aria-pressed={selectedTierId === item.id} onClick={() => onSelect(item.id)}>
                {badge && <span className="badge">{badge}</span>}
                <div className="size">{item.size}</div>
                <div className="price">{formatMoney(item.price)}</div>
                <div className="name">{item.name}</div>
                <div className="note">{isMostChosen ? `${socialProof!.sharePercent}% of tracked Celebration orders` : `Up to ${item.maxChoices} gifts`}</div>
              </TiltTierButton>
            )
          })}
        </div>
        <div className="budgetDecisionHint">
          <div><b>Not sure which one to choose?</b><span>Start with Recommended, or tell us your exact budget and we’ll suggest a better fit.</span></div>
          <a className="secondary" href="#custom-request">Build around my budget</a>
        </div>
      </div>
    </section>
  )
}
