"use client"

import Image from "next/image"
import type { Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
import { requestBuilderOpen } from "../builder/builder-events"

const photos = [
  "/images/campaign/hero-800.webp",
  "/images/campaign/occasion-800.webp",
  "/images/campaign/hero-800.webp",
  "/images/campaign/occasion-800.webp"
]

export function FeaturedHamperCards({ tiers, deliveryFee }: { tiers: Tier[]; deliveryFee: number }) {
  return <div className="cbProductGrid cbHamperProducts">
    {tiers.map((tier, index) => <article className="cbHamperCard" key={tier.id}>
      <div className="cbHamperPhoto">
        <Image src={photos[index % photos.length]} alt={`Celebration gift hamper styling inspiration for ${tier.name}`} fill sizes="(max-width:700px) 46vw, 22vw" loading="lazy" />
        <span className="cbEditorialNote">Styling inspiration</span>
      </div>
      <div className="cbHamperDetails">
        <span className="cbCardKicker">CURATED HAMPER</span>
        <h4>{tier.name}</h4>
        <p>Curated for your occasion</p>
        <strong>{formatMoney(tier.price)}</strong>
        <small>+ {formatMoney(deliveryFee)} delivery · {tier.size}</small>
        <button className="cbPrimaryBtn" type="button" onClick={() => requestBuilderOpen(2, tier.id)}>Choose this hamper</button>
      </div>
    </article>)}
  </div>
}
