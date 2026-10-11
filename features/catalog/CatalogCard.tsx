"use client"

import Link from "next/link"
import { catalogImageVariant, catalogSpriteImage, isIndividualListing, isIndividuallySellable, primaryProductImage, type GiftProduct } from "../../lib/domain/catalog"
import { productBadge, productSavingLabel } from "../../lib/domain/catalog-badges"
import { AddToCart } from "../cart/AddToCart"
import { formatMoney } from "../../lib/domain/money"
import { SafeCatalogImage } from "./SafeCatalogImage"
import { catalogCardTreatment } from "../../lib/domain/catalog-card-presentation"

export function CatalogProductImage({ product, priority = false, imageVariant = "thumb" }: { product: GiftProduct; priority?: boolean; imageVariant?: "thumb" | "main" }) {
  const primary = primaryProductImage(product)
  if (primary) {
    const sprite = catalogSpriteImage(primary.url)
    if (sprite) {
      return <SafeCatalogImage
        className="catalogPhoto catalogSpritePhoto"
        src={sprite.url}
        fallbackSrc={primary.fallbackUrl}
        objectPosition={sprite.backgroundPosition}
        alt={primary.alt || product.name}
        loading={priority ? "eager" : "lazy"}
      />
    }
    return <SafeCatalogImage
      className="catalogPhoto"
      src={catalogImageVariant(primary.url, imageVariant)}
      fallbackSrc={primary.fallbackUrl}
      alt={primary.alt || product.name}
      loading={priority ? "eager" : "lazy"}
    />
  }
  return <SafeCatalogImage className="catalogPhoto" src="" alt={product.name} />
}

export function CatalogCard({ product, imageVariant = "thumb" }: { product: GiftProduct; imageVariant?: "thumb" | "main" }) {
  const listed = isIndividualListing(product)
  const individual = isIndividuallySellable(product)
  const soldOut = listed && !individual
  const badge = productBadge(product)
  const savings = productSavingLabel(product)
  const mrpPaise = listed ? product.retail?.mrpPaise : undefined
  const treatment = catalogCardTreatment(product)
  return (
    <article className={`catalogCard catalogCard--${treatment}${imageVariant === "main" && product.id === "celebration-ring-001" ? " catalogCard--featuredPortraitRing" : ""}`}>
      <Link href={`/jewelry/${encodeURIComponent(product.id)}`} className="catalogCardLink" prefetch={false}>
        <div className="catalogCardVisual"><div className="catalogCardMedia"><CatalogProductImage product={product} imageVariant={imageVariant} /></div><span className="catalogCardArrow" aria-hidden="true">→</span></div>
        <div className="catalogCardInfo">
          {badge && <span className={`catalogCardBadge catalogCardBadgeInline catalogCardBadge--${badge.kind}`}>{badge.label}</span>}
          <span className="catalogCardCategory">{product.category}</span>
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          {product.retail?.warrantyOrGuarantee && <small className="catalogGuarantee">✓ 6-month anti-tarnish guarantee</small>}
          {product.prepackagedRetail && <small className="catalogLegalHint">Product declarations available in details</small>}
          <div className="catalogCardPrice"><span>{soldOut ? "Currently sold out" : listed ? "Individual item" : "In hampers from"}</span><strong>{formatMoney(listed ? product.salePricePaise! / 100 : product.minTier)}</strong>{listed && mrpPaise && product.salePricePaise && mrpPaise > product.salePricePaise ? <small><s>MRP {formatMoney(mrpPaise / 100)}</s>{savings && badge?.kind !== "discount" ? ` · ${savings}` : null}</small> : null}</div>
        </div>
      </Link>
      {individual && <AddToCart productId={product.id} productName={product.name} productCategory={product.category} pricePaise={product.salePricePaise} maxQuantity={product.stockAvailable ?? 1} />}
    </article>
  )
}
