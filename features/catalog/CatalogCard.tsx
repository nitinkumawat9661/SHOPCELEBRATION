"use client"

import Link from "next/link"
import { catalogImageVariant, catalogSpriteImage, isIndividualListing, isIndividuallySellable, primaryProductImage, productDiscountPercent, type GiftProduct } from "../../lib/domain/catalog"
import { AddToCart } from "../cart/AddToCart"
import { formatMoney } from "../../lib/domain/money"
import { SafeCatalogImage } from "./SafeCatalogImage"

export function CatalogProductImage({ product, priority = false }: { product: GiftProduct; priority?: boolean }) {
  const primary = primaryProductImage(product)
  if (primary) {
    const sprite = catalogSpriteImage(primary.url)
    if (sprite) {
      return <div
        className="catalogPhoto catalogSpritePhoto"
        role="img"
        aria-label={primary.alt || product.name}
        style={{ backgroundImage: `url("${sprite.url}")`, backgroundPosition: sprite.backgroundPosition }}
      />
    }
    return <SafeCatalogImage
      className="catalogPhoto"
      src={catalogImageVariant(primary.url, "thumb")}
      fallbackSrc={primary.fallbackUrl}
      alt={primary.alt || product.name}
      loading={priority ? "eager" : "lazy"}
    />
  }
  return <SafeCatalogImage className="catalogPhoto" src="" alt={product.name} />
}

export function CatalogCard({ product }: { product: GiftProduct }) {
  const listed = isIndividualListing(product)
  const individual = isIndividuallySellable(product)
  const soldOut = listed && !individual
  const discount = listed ? productDiscountPercent(product) : null
  const mrpPaise = listed ? product.retail?.mrpPaise : undefined
  return (
    <article className="catalogCard">
      <Link href={`/jewelry/${encodeURIComponent(product.id)}`} className="catalogCardLink" prefetch={false}>
        <div className="catalogCardVisual"><CatalogProductImage product={product} />{soldOut ? <span className="catalogCardBadge">Sold out</span> : product.badge && <span className="catalogCardBadge">{product.badge}</span>}<span className="catalogCardArrow" aria-hidden="true">→</span></div>
        <div className="catalogCardInfo">
          <span className="catalogCardCategory">{product.category}</span>
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          {product.retail?.warrantyOrGuarantee && <small className="catalogGuarantee">✓ 6-month anti-tarnish guarantee</small>}
          {product.prepackagedRetail && <small className="catalogLegalHint">Product declarations available in details</small>}
          <div className="catalogCardPrice"><span>{soldOut ? "Currently sold out" : listed ? "Individual item" : "In hampers from"}</span><strong>{formatMoney(listed ? product.salePricePaise! / 100 : product.minTier)}</strong>{listed && mrpPaise && discount ? <small><s>{formatMoney(mrpPaise / 100)}</s> {discount}% OFF</small> : null}</div>
        </div>
      </Link>
      {individual && <AddToCart productId={product.id} productName={product.name} productCategory={product.category} pricePaise={product.salePricePaise} maxQuantity={product.stockAvailable ?? 1} />}
    </article>
  )
}
