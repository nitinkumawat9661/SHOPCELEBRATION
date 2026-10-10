"use client"

import { isPublicHamperOrderProof, type HamperOrderProof } from "../../lib/domain/real-social-proof"
import type { Tier } from "../../lib/domain/catalog"

/**
 * Optional proof rail for pages with an eligible verified sample. The live
 * homepage displays its own small aggregate instead. Never render a template
 * five-star graphic, a fabricated review, or a sales ticker.
 */
export function ProofAndReviews({ socialProof, activeTiers = [] }: {
  socialProof: HamperOrderProof | null
  activeTiers?: Pick<Tier, "name" | "active">[]
}) {
  if (!isPublicHamperOrderProof(socialProof, activeTiers)) return null

  return <section className="proofReviewsSection" aria-label="Delivered hamper order insight">
    <div className="wrap">
      <div className="centerHead proofHead">
        <div className="kicker">REAL HAMPER ORDERS</div>
        <h2>What customers chose</h2>
        <p>
          {socialProof.sharePercent}% of {socialProof.totalOrders} paid and delivered hampers
          used the {socialProof.tierName} budget.
        </p>
      </div>
    </div>
  </section>
}
