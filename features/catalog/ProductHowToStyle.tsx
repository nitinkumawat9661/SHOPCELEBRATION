import type { GiftProduct } from "../../lib/domain/catalog"
import { stylingAdviceForProduct } from "../../lib/domain/product-styling"

export function ProductHowToStyle({ product }: { product: GiftProduct }) {
  const advice = stylingAdviceForProduct(product)

  return (
    <section className="productStyling" aria-labelledby="product-styling-title">
      <span className="productStylingEyebrow">{advice.categoryKind === "gift" ? "GIFT PRESENTATION" : "OUTFIT PAIRINGS"}</span>
      <h2 id="product-styling-title">{advice.heading}</h2>
      <p className="productStylingIntro">{advice.intro}</p>
      <div className="productStylingLayout">
        <div className="productStylingIdeas">
          <h3>{advice.categoryKind === "gift" ? "A few ways to present it" : "Outfit ideas"}</h3>
          <ul>{advice.ideas.map((idea) => <li key={idea}>{idea}</li>)}</ul>
          {advice.pairingNote && <p className="productStylingPairing">{advice.pairingNote}</p>}
        </div>
        <div className="productStylingCare">
          <h3>Care and storage</h3>
          <ul>{advice.care.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      </div>
    </section>
  )
}
