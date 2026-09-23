import { canSelectProduct, formatMoney, type CatalogConfig, type CategoryOption, type GiftProduct, type SelectionRule, type Tier } from "../../../lib/domain/catalog"
import { uiContent } from "../../../lib/domain/content"

function ruleMessage(rule: SelectionRule, copy: typeof uiContent.builder.products) {
  if (rule.reason === "minTier") return copy.availableFrom.replace("{amount}", formatMoney(rule.value || 0))
  if (rule.reason === "maxChoices") return copy.maxChoices.replace("{count}", String(rule.value || 0))
  if (rule.reason === "pointBudget") return copy.mixExceedsBudget
  return ""
}

function ProductVisual({ product }: { product: GiftProduct }) {
  if (product.imageUrl) return <img className="catalogProductImage" src={product.imageUrl} alt="" loading="lazy" />
  return <span className="pickIcon">{product.icon || "🎁"}</span>
}

export function ProductStep({ catalog, tier, products, categories, category, search, selected, pointsUsed, onCategory, onSearch, onToggle, onBack, onNext }: {
  catalog: CatalogConfig
  tier: Tier
  products: GiftProduct[]
  categories: CategoryOption[]
  category: string
  search: string
  selected: string[]
  pointsUsed: number
  onCategory: (value: string) => void
  onSearch: (value: string) => void
  onToggle: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const copy = uiContent.builder.products
  const choiceLimitReached = selected.length >= tier.maxChoices
  const pointLimitReached = pointsUsed >= tier.pointBudget
  const clearFilters = () => { onSearch(""); onCategory(catalog.settings.allCategory.id) }

  return (
    <div className="stepPane active">
      <div className="builderTitle">
        <div><h3>{copy.title}</h3><p>{formatMoney(tier.price)}{uiContent.common.separator}{selected.length}/{tier.maxChoices} gifts selected</p></div>
        <input className="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder={copy.search} aria-label="Search gifts" />
      </div>
      {(choiceLimitReached || pointLimitReached) && <div className="builderInlineNotice" role="status"><b>Your hamper is full.</b> {choiceLimitReached ? `This ${formatMoney(tier.price)} hamper can include up to ${tier.maxChoices} selected gifts.` : "This combination has reached the selected budget. Remove one gift to choose another."}</div>}
      <div className="filters builderFilter">{categories.map((item) => <button type="button" key={item.id} className={`chip ${category === item.id ? "active" : ""}`} onClick={() => onCategory(item.id)}>{item.label}</button>)}</div>
      <div className="pickGrid">
        {products.length === 0 && <div className="emptyFilterState"><b>No gifts found here</b><p>Clear the search or category to see all available options.</p><button className="secondary" type="button" onClick={clearFilters}>Show all gifts</button></div>}
        {products.map((product) => {
          const selectedNow = selected.includes(product.id)
          const rule = canSelectProduct(catalog, tier, selected, product)
          const disabled = !selectedNow && !rule.ok
          return (
            <button type="button" key={product.id} className={`pick ${selectedNow ? "active" : ""} ${disabled ? "locked" : ""}`} disabled={disabled} onClick={() => onToggle(product.id)} aria-pressed={selectedNow}>
              <ProductVisual product={product} />
              <div className="pickCopy"><b>{product.name}</b><small>{product.category}</small>{disabled && <em>{ruleMessage(rule, copy)}</em>}</div>
              <span className="check">{selectedNow ? copy.selected : disabled ? copy.locked : copy.add}</span>
            </button>
          )
        })}
      </div>
      <div className="navRow"><button className="secondary" type="button" onClick={onBack}>{copy.back}</button><span className="tiny">{selected.length} {copy.selectedSuffix}</span><button className="primary" type="button" onClick={onNext}>{copy.next}</button></div>
    </div>
  )
}
