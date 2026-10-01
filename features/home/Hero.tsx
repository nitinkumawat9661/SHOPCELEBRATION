import Link from "next/link"
import Image from "next/image"
import type { Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
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
        <span className="celebrationEyebrow">A little thought. A lot of love.</span>
        <h1 id="gift-hero-title">Gifts that<br />speak from<br />the <em>heart.</em></h1>
        <p>Thoughtful hampers. Beautiful little details.<br />For every person, and every kind of love.</p>
        <div className="celebrationHeroActions"><a className="celebrationButton" href="#budgets">Shop Hampers <StoreIcon name="arrow" size={17} /></a><Link className="celebrationButton light" href="/jewelry" prefetch={false}>Explore Jewelry</Link></div>
        {minPrice !== null && <small className="celebrationHeroFoot">Made personal. From {formatMoney(minPrice)}.</small>}
      </div>
      <div className="celebrationHeroNote" aria-hidden="true">Make every occasion<br /><em>a Celebration</em></div>
    </div>
    <small className="celebrationImageCaption">Gifting inspiration · hamper contents vary</small>
  </section>
}
