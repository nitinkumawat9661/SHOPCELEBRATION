"use client"

import { formatMoney, type GiftProduct, type Tier } from "../../lib/domain/catalog"
import { storeContent, uiContent } from "../../lib/domain/content"
import { ShapeWaves } from "../motion/ShapeWaves"

export function AdminPreviewHero({ onBuild, tiers, products }: { onBuild: () => void; tiers: Tier[]; products: GiftProduct[] }) {
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
          <h1><span className="heroLead">{storeContent.brand.heroTitleLine1}</span><span className="heroItalic">{storeContent.brand.heroTitleLine2}</span></h1>
          <p>{storeContent.brand.heroBody}</p>
          <div className="actions heroActions">
            <button type="button" className="primary" onClick={onBuild}>{uiContent.hero.primary}</button>
            <button type="button" className="secondary" onClick={onBuild}>{uiContent.hero.secondaryPrefix} {formatMoney(minPrice)}</button>
          </div>
          <div className="heroFacts" aria-label="Hamper highlights">
            <div><b>{formatMoney(minPrice)}–{formatMoney(maxPrice)}</b><small>{uiContent.hero.stats[0]}</small></div>
            <div><b>{products.length}+</b><small>{uiContent.hero.stats[1]}</small></div>
            <div><b>{uiContent.hero.customFeelValue}</b><small>{uiContent.hero.stats[2]}</small></div>
          </div>
        </div>
        <div className="heroVisual heroImmediateVisual">
          <div className="heroVisualTop"><span>Made around their moment</span><i aria-hidden="true">{storeContent.brand.giftIcon}</i></div>
          <p className="heroVisualLine">Pick a budget. Add what feels right. We’ll pack it beautifully.</p>
          <div className="heroVisualItems">{showcaseItems.map((item) => <div className="heroVisualItem" key={item.label}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></div>)}</div>
          <div className="heroVisualFooter"><span>Clear pricing</span><span>Packing video</span><span>Trackable order</span></div>
        </div>
      </div>
    </header>
  )
}
