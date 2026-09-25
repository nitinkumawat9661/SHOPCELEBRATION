import type { GiftProduct, Tier } from "../../lib/domain/catalog"
import { storeContent } from "../../lib/domain/content"
import { formatMoney } from "../../lib/domain/money"
import { ShapeWaves } from "../motion/ShapeWaves"

export function Hero({ tiers, products }: { tiers: Tier[]; products: GiftProduct[] }) {
  const prices = tiers.map((tier) => tier.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const showcaseItems = storeContent.showcaseItems.slice(0, 3)

  return (
    <header className="hero heroRefresh heroClassicMotion">
      <ShapeWaves className="heroShapeWaves heroPixelField" color="#8b2529" cellSize={15} />
      <div className="wrap heroGrid">
        <div className="heroCopy heroImmediate">
          <div className="eyebrow">Premium hampers · made to fit your budget</div>
          <h1>
            <span className="heroLead">Make their day.</span>
            <span className="heroItalic">Without overspending.</span>
          </h1>
          <p>Choose your budget. We turn it into a hamper that looks premium, feels personal and arrives beautifully packed.</p>

          <div className="actions heroActions">
            <a className="primary heroPrimaryLink" href="#budgets">Build my hamper</a>
            <a className="secondary" href="#budgets">Starts at {formatMoney(minPrice)}</a>
          </div>

          <div className="heroFacts" aria-label="Hamper highlights">
            <div><b>{formatMoney(minPrice)}–{formatMoney(maxPrice)}</b><small>clear budget options</small></div>
            <div><b>{products.length}+</b><small>gift choices</small></div>
            <div><b>Personal</b><small>made for them</small></div>
          </div>
        </div>

        <div className="heroVisual heroImmediateVisual">
          <div className="heroVisualTop">
            <span>Curated for their moment</span>
            <i aria-hidden="true">{storeContent.brand.giftIcon}</i>
          </div>
          <p className="heroVisualLine">A little luxury, made personal.</p>
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
