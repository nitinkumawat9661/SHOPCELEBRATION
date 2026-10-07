"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { catalogSpriteImage, isIndividuallySellable, primaryProductImage, productDiscountPercent, type GiftProduct } from "../../lib/domain/catalog"
import { AddToCart } from "../cart/AddToCart"
import { formatMoney } from "../../lib/domain/money"

export function CatalogProductImage({ product, priority = false }: { product: GiftProduct; priority?: boolean }) {
  const [failed, setFailed] = useState(false)

  const primary = primaryProductImage(product)

  useEffect(() => {
    setFailed(false)
  }, [primary?.url])

  if (primary && !failed) {
    const sprite = catalogSpriteImage(primary.url)
    if (sprite) {
      return <div
        className="catalogPhoto catalogSpritePhoto"
        role="img"
        aria-label={primary.alt || product.name}
        style={{ backgroundImage: `url("${sprite.url}")`, backgroundPosition: sprite.backgroundPosition }}
      />
    }
    return <img
      className="catalogPhoto"
      src={primary.url}
      alt={primary.alt || product.name}
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
  const discount = individual ? productDiscountPercent(product) : null
  const mrpPaise = individual ? product.retail?.mrpPaise : undefined
  return (
    <article className="catalogCard">
      <Link href={`/jewelry/${encodeURIComponent(product.id)}`} className="catalogCardLink" prefetch={false}>
        <div className="catalogCardVisual"><CatalogProductImage product={product} />{product.badge && <span className="catalogCardBadge">{product.badge}</span>}<span className="catalogCardArrow" aria-hidden="true">→</span></div>
        <div className="catalogCardInfo">
          <span className="catalogCardCategory">{product.category}</span>
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          {product.retail?.warrantyOrGuarantee && <small className="catalogGuarantee">✓ 6-month anti-tarnish guarantee</small>}
          {product.prepackagedRetail && <small className="catalogLegalHint">Product declarations available in details</small>}
          <div className="catalogCardPrice"><span>{individual ? "Individual item" : "In hampers from"}</span><strong>{formatMoney(individual ? product.salePricePaise! / 100 : product.minTier)}</strong>{individual && mrpPaise && discount ? <small><s>{formatMoney(mrpPaise / 100)}</s> {discount}% OFF</small> : null}</div>
        </div>
      </Link>
      {individual && <AddToCart productId={product.id} />}
    </article>
  )
}
