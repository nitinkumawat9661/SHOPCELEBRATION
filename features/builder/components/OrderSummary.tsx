import { formatMoney, type Tier } from "../../../lib/domain/catalog"
import { uiContent } from "../../../lib/domain/content"
import type { CheckoutData } from "../types"

export function OrderSummary({ tier, checkout }: { tier: Tier; checkout: CheckoutData }) {
  const copy = uiContent.builder.summary
  return (
    <div className="summary">
      <div className="kicker">{copy.kicker}</div>
      <div className="sumPrice">{formatMoney(tier.price)}</div>
      <div className="sumRow"><span>{copy.hamper}</span><b>{tier.name}</b></div>
      <div className="sumRow"><span>{copy.box}</span><b>{tier.size}</b></div>
      <div className="sumRow"><span>{copy.occasion}</span><b>{checkout.occasion}</b></div>
      <div className="sumRow"><span>{copy.products}</span><b>{tier.maxChoices} items</b></div>
      <div className="sumRow"><span>{copy.requiredBy}</span><b>{checkout.requiredDate || copy.notSet}</b></div>
      <div className="summaryChips"><span>{copy.curate}</span></div>
      <div className="note">{copy.note}</div>
    </div>
  )
}
