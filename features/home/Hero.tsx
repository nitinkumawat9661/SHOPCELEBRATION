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
    <header className="hero heroPremiumV2">
      <ShapeWaves className="heroShapeWaves heroPixelField" color="#8b2529" cellSize={16} />
      <div className="heroPremiumVeil" aria-hidden="true" />

      <div className="wrap heroPremiumGrid">
        <div className="heroPremiumCopy">
          <div className="heroPremiumEyebrow">
            <span>Celebration custom hampers</span>
            <b>Made around your budget</b>
          </div>

          <h1>
            <span>Looks premium.</span>
            <span>Feels personal.</span>
            <em>Stays in your budget.</em>
          </h1>

          <p className="heroPremiumBody">
            Pick your budget first. We turn it into a hamper that feels thoughtfully put together, not randomly packed.
          </p>

          <div className="heroPremiumActions">
            <a className="primary heroPremiumPrimary" href="#budgets">Build my hamper</a>
            <a className="heroPremiumSecondary" href="#budgets">Explore from {formatMoney(minPrice)} <span aria-hidden="true">→</span></a>
          </div>

          <div className="heroPremiumProof" aria-label="Celebration order benefits">
            <span><i aria-hidden="true">✓</i> Clear pricing</span>
            <span><i aria-hidden="true">✓</i> Packing proof</span>
            <span><i aria-hidden="true">✓</i> Trackable order</span>
          </div>

          <div className="heroPremiumRange">
            <div><small>Starting at</small><b>{formatMoney(minPrice)}</b></div>
            <div><small>Budget range</small><b>{formatMoney(minPrice)}–{formatMoney(maxPrice)}</b></div>
            <div><small>Gift choices</small><b>{products.length}+</b></div>
          </div>
        </div>

        <div className="heroPremiumStage" aria-label="Example Celebration hamper presentation">
          <div className="heroPremiumPricePill">
            <small>Hampers from</small>
            <b>{formatMoney(minPrice)}</b>
          </div>

          <div className="heroPremiumCard">
            <div className="heroPremiumCardTop">
              <span>The Celebration Edit</span>
              <i>01</i>
            </div>

            <div className="heroGiftScene">
              <div className="heroGiftBox" aria-hidden="true">
                <span className="heroRibbonHorizontal" />
                <span className="heroRibbonVertical" />
                <i>{storeContent.brand.giftIcon}</i>
              </div>
              <div className="heroGiftCopy">
                <small>Made for their moment</small>
                <strong>A gift that looks considered.</strong>
              </div>
            </div>

            <div className="heroPremiumItems">
              {showcaseItems.map((item) => (
                <div key={item.label}>
                  <i aria-hidden="true">{item.icon}</i>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="heroPremiumCardBottom">
              <span>You set the budget.</span>
              <b>We build the moment.</b>
            </div>
          </div>

          <div className="heroPremiumFloat heroPremiumFloatOne">
            <i aria-hidden="true">▶</i>
            <div><small>Before dispatch</small><b>Packing video</b></div>
          </div>

          <div className="heroPremiumFloat heroPremiumFloatTwo">
            <i aria-hidden="true">↗</i>
            <div><small>After dispatch</small><b>Order tracking</b></div>
          </div>
        </div>
      </div>
    </header>
  )
}
