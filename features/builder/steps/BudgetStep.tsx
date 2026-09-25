import { formatMoney, type Tier } from "../../../lib/domain/catalog"
import { uiContent } from "../../../lib/domain/content"

export function BudgetStep({ tierId, occasion, tiers, occasions, onTier, onOccasion, onNext }: {
  tierId: string
  occasion: string
  tiers: Tier[]
  occasions: string[]
  onTier: (id: string) => void
  onOccasion: (value: string) => void
  onNext: () => void
}) {
  const copy = uiContent.builder.budget
  return (
    <div className="stepPane active">
      <div className="builderTitle">
        <div><h3>{copy.title}</h3><p>{copy.body}</p></div>
        <select className="selectOcc" aria-label="Occasion" value={occasion} onChange={(event) => onOccasion(event.target.value)}>{occasions.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="tierSmall">{tiers.map((item) => <button type="button" key={item.id} className={tierId === item.id ? "active" : ""} onClick={() => onTier(item.id)}><b>{formatMoney(item.price)}</b><span>{item.name} • {item.size}</span></button>)}</div>
      <div className="nextRow"><button type="button" className="primary" onClick={onNext}>{copy.next}</button></div>
    </div>
  )
}
