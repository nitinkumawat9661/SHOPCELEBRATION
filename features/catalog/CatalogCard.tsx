"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { isIndividuallySellable, type GiftProduct } from "../../lib/domain/catalog"
import { AddToCart } from "../cart/AddToCart"
import { formatMoney } from "../../lib/domain/money"

export function CatalogProductImage({ product, priority = false }: { product: GiftProduct; priority?: boolean }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [product.imageUrl])

  if (product.imageUrl && !failed) {
    return <img
      className="catalogPhoto"
      src={product.imageUrl}
      alt={product.name}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  }

  return (
    <div className={`catalogPhotoPlaceholder${failed ? " catalogPhotoFailed" : ""}`} role="img" aria-label={`${product.name} image ${failed ? "unavailable" : "not added"}`}>
      <span className="catalogPhotoPlaceholderIcon" aria-hidden="true">{product.icon || "✦"}</span>
      {failed && <small>Image unavailable</small>}
      {!failed && <small>{product.category}</small>}
    </div>
  )
}

export function CatalogCard({ product }: { product: GiftProduct }) {
  const individual = isIndividuallySellable(product)
  return (
    <article className="catalogCard">
      <Link href={`/jewelry/${encodeURIComponent(product.id)}`} className="catalogCardLink" prefetch={false}>
        <div className="catalogCardVisual"><CatalogProductImage product={product} /><span className="catalogCardArrow" aria-hidden="true">→</span></div>
        <div className="catalogCardInfo">
          <span className="catalogCardCategory">{product.category}</span>
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          <div className="catalogCardPrice"><span>{individual ? "Individual item" : "In hampers from"}</span><strong>{formatMoney(individual ? product.salePricePaise! / 100 : product.minTier)}</strong></div>
        </div>
      </Link>
      {individual && <AddToCart productId={product.id} />}
    </article>
  )
}
