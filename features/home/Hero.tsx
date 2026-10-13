import Link from "next/link"
import Image from "next/image"
import type { Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
import { hamperFinalPriceRupees } from "../../config/self-build-delivery"
import { StoreIcon } from "../shell/StoreIcon"

export function Hero({ tiers }: { tiers: Tier[] }) {
  const minPrice = tiers.length ? Math.min(...tiers.map((tier) => tier.price)) : null
  return <section className="celebrationHero" aria-labelledby="gift-hero-title">
    <picture className="celebrationHeroPhoto">
      <source media="(max-width: 640px)" srcSet="/images/campaign/hero-800.webp" />
      <Image src="/images/campaign/hero-1600.webp" alt="" width={1600} height={900} unoptimized fetchPriority="high" />
    </picture>
    <div className="wrap celebrationHeroInner">
      <div className="celebrationHeroCopy">
        <span className="celebrationEyebrow">JEWELRY / CUSTOM HAMPERS</span>
        <h1 id="gift-hero-title">Jewelry to wear.<br />Hampers to <em>give.</em></h1>
        <p>Browse necklaces, rings and bracelets. For a custom hamper, start with a budget and tell us the occasion.</p>
        <div className="celebrationHeroActions"><a className="celebrationButton" href="#budgets">Shop Hampers <StoreIcon name="arrow" size={17} /></a><Link className="celebrationButton light" href="/jewelry" prefetch={false}>Explore Jewelry</Link></div>
        {minPrice !== null && <small className="celebrationHeroFoot">Custom hampers from {formatMoney(hamperFinalPriceRupees(minPrice))}.</small>}
      </div>
    </div>
    <div className="celebrationHeroNote" aria-hidden="true">Celebration<br /><em>Gifts &amp; Jewelry</em></div>
    <small className="celebrationImageCaption">Gifting inspiration · hamper contents vary</small>
  </section>
}
