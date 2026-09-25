import type { GiftProduct, Tier } from "../../lib/domain/catalog"
import { storeContent, uiContent } from "../../lib/domain/content"
import { formatMoney } from "../../lib/domain/money"
import { ShapeWaves } from "../motion/ShapeWaves"

export function Hero({ tiers, products }: { tiers: Tier[]; products: GiftProduct[] }) {
  const prices = tiers.map((tier) => tier.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const showcaseItems = storeContent.showcaseItems.slice(0, 3)

  return (
    <header className="hero heroRefresh">
      <ShapeWaves className="heroShapeWaves" color="#8b2529" cellSize={15} />
      <div className="wrap heroGrid">
        <div className="heroCopy heroImmediate">
          <div className="eyebrow">{storeContent.brand.eyebrow}</div>
          <h1>
            <span className="heroLead">{storeContent.brand.heroTitleLine1}</span>
            <span className="heroItalic">{storeContent.brand.heroTitleLine2}</span>
          </h1>
          <p>{storeContent.brand.heroBody}</p>
          <div className="actions heroActions">
            <a className="primary heroPrimaryLink" href="#budgets">{uiContent.hero.primary}</a>
            <a className="secondary" href="#budgets">{uiContent.hero.secondaryPrefix} {formatMoney(minPrice)}</a>
          </div>
          <div className="heroFacts" aria-label="Hamper highlights">
            <div><b>{formatMoney(minPrice)}–{formatMoney(maxPrice)}</b><small>{uiContent.hero.stats[0]}</small></div>
            <div><b>{products.length}+</b><small>{uiContent.hero.stats[1]}</small></div>
            <div><b>{uiContent.hero.customFeelValue}</b><small>{uiContent.hero.stats[2]}</small></div>
          </div>
        </div>

        <div className="heroVisual heroImmediateVisual">
          <div className="heroVisualTop">
            <span>Made around their moment</span>
            <i aria-hidden="true">{storeContent.brand.giftIcon}</i>
          </div>
          <p className="heroVisualLine">A little box of reasons to smile.</p>
          <div className="heroVisualItems">
            {showcaseItems.map((item) => (
              <div className="heroVisualItem" key={item.label}>
                <i aria-hidden="true">{item.icon}</i>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="heroVisualFooter">
            <span>Clear pricing</span><span>Packing video</span><span>Trackable order</span>
          </div>
        </div>
      </div>
    </header>
  )
}
