import type { GiftProduct } from "../../lib/domain/catalog"
import { stylingAdviceForProduct } from "../../lib/domain/product-styling"

export function ProductHowToStyle({ product }: { product: GiftProduct }) {
  const advice = stylingAdviceForProduct(product)

  return (
    <section className="productStyling" aria-labelledby="product-styling-title">
      <span className="productStylingEyebrow">Wear it your way</span>
      <h2 id="product-styling-title">{advice.heading}</h2>
      <p className="productStylingIntro">{advice.intro}</p>
      <div className="productStylingLayout">
        <div className="productStylingIdeas">
          <h3>Try it with</h3>
          <ul>{advice.ideas.map((idea) => <li key={idea}>{idea}</li>)}</ul>
          {advice.pairingNote && <p className="productStylingPairing">{advice.pairingNote}</p>}
        </div>
        <div className="productStylingCare">
          <h3>A few care tips</h3>
          <ul>{advice.care.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      </div>
    </section>
  )
}
