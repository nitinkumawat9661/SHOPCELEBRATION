"use client"

import { SpotlightCard } from "../motion/InteractiveSurface"
import { Reveal } from "../motion/Reveal"

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

type ProofAndReviewsProps = {
  socialProof: TierSocialProof | null
}

type ProofItem = {
  kicker: string
  value: string
  title: string
  body: string
}

export function ProofAndReviews({ socialProof }: ProofAndReviewsProps) {
  const proofs: ProofItem[] = [
    ...(socialProof && socialProof.totalOrders > 0 ? [{
      kicker: "LIVE ORDER SIGNAL",
      value: `${socialProof.sharePercent}%`,
      title: `choose ${socialProof.tierName}`,
      body: `Based on ${socialProof.totalOrders} tracked Celebration orders.`
    }] : []),
    {
      kicker: "BEFORE DISPATCH",
      value: "VIDEO",
      title: "See the finished hamper",
      body: "A packing video is shared before dispatch so the presentation can be reviewed first."
    },
    {
      kicker: "AFTER ORDER",
      value: "TRACK",
      title: "Follow every update",
      body: "Each order gets a Celebration ID with progress and shipping details in My Celebration."
    },
    {
      kicker: "PAYMENT",
      value: "UPI",
      title: "Reference-backed confirmation",
      body: "The payment number shown in your UPI app helps us confirm a manual UPI payment."
    }
  ]

  return (
    <section className="proofReviewsSection" id="proof">
      <div className="wrap">
        <Reveal>
          <div className="centerHead proofHead">
            <div className="kicker">REVIEWS & REAL PROOF</div>
            <h2>Confidence should come from <span className="textAccentInline">what you can verify.</span></h2>
            <p>We use real order signals and visible process checkpoints. Customer quotes are published only when they can be tied to genuine Celebration orders.</p>
          </div>
        </Reveal>

        <div className="proofMarquee" aria-label="Celebration order proof">
          <div className="proofMarqueeTrack">
            {[0, 1].map((repeat) => (
              <div className="proofMarqueeGroup" key={repeat} aria-hidden={repeat === 1 ? "true" : undefined}>
                {proofs.map((item) => (
                  <SpotlightCard className="proofCard" key={`${repeat}-${item.kicker}-${item.value}`}>
                    <div className="proofCardKicker">{item.kicker}</div>
                    <strong className="proofCardValue">{item.value}</strong>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </SpotlightCard>
                ))}
              </div>
            ))}
          </div>
        </div>

        <Reveal delay={100}>
          <div className="reviewIntegrityGrid">
            <SpotlightCard className="reviewIntegrityCard">
              <div className="reviewStars" aria-hidden="true">★★★★★</div>
              <div className="kicker">VERIFIED REVIEWS ONLY</div>
              <h3>Reviews will be real, or they won’t be shown.</h3>
              <p>We are not filling the storefront with stock testimonials. Once a delivered order produces verified feedback, the same premium review rail will publish it here.</p>
              <div className="reviewIntegrityMeta"><span>✓ Order-linked</span><span>✓ No fabricated quotes</span><span>✓ Transparent source</span></div>
            </SpotlightCard>
            <div className="proofProcessCard">
              <span className="proofProcessNumber">01</span><b>Choose</b><small>Budget + gifts</small>
              <span className="proofProcessArrow">→</span>
              <span className="proofProcessNumber">02</span><b>Review</b><small>Packing video</small>
              <span className="proofProcessArrow">→</span>
              <span className="proofProcessNumber">03</span><b>Track</b><small>Order + shipping</small>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
