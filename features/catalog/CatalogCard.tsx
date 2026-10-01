"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import type { GiftProduct } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"

export function CatalogProductImage({ product, priority = false }: { product: GiftProduct; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  return product.imageUrl && !failed ? (
    <Image className="catalogPhoto" src={product.imageUrl} alt={product.name} width={800} height={1000} sizes={priority ? "(max-width: 700px) 100vw, 50vw" : "(max-width: 700px) 45vw, (max-width: 1050px) 30vw, 25vw"} unoptimized={!product.imageUrl.startsWith("/api/catalog/image?key=")} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} onError={() => setFailed(true)} />
  ) : (
    <div className="catalogPhotoPlaceholder">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="5" y="7" width="30" height="26" rx="4" stroke="currentColor" strokeWidth="1.3" /><circle cx="15" cy="16" r="3" stroke="currentColor" strokeWidth="1.3" /><path d="m7 29 8-7 6 5 7-10 7 9" stroke="currentColor" strokeWidth="1.3" /></svg>
      <span>Photo coming soon</span>
      <small>{product.category}</small>
    </div>
  )
}

export function CatalogCard({ product }: { product: GiftProduct }) {
  return (
    <article className="catalogCard">
      <Link href={`/jewelry/${encodeURIComponent(product.id)}`} className="catalogCardLink" prefetch={false}>
        <div className="catalogCardVisual"><CatalogProductImage product={product} /><span className="catalogCardArrow" aria-hidden="true">→</span></div>
        <div className="catalogCardInfo">
          <span className="catalogCardCategory">{product.category}</span>
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          <div className="catalogCardPrice"><span>In hampers from</span><strong>{formatMoney(product.minTier)}</strong></div>
        </div>
      </Link>
    </article>
  )
}
