"use client"

import { useMemo, useState } from "react"
import { catalogImageVariant, catalogSpriteImage, productImages, type GiftProduct } from "../../lib/domain/catalog"
import { SafeCatalogImage } from "./SafeCatalogImage"
import { productBadge } from "../../lib/domain/catalog-badges"

export function ProductGallery({ product }: { product: GiftProduct }) {
  const images = useMemo(() => productImages(product), [product])
  const [selection, setSelection] = useState({ productId: product.id, index: 0 })
  // A client-side product switch must not keep the previous product's thumbnail
  // selection or reuse a pending image/failure event from the previous SKU.
  const active = selection.productId === product.id && selection.index < images.length ? selection.index : 0
  const current = images[active] || images[0]
  const badge = productBadge(product)

  function select(index: number) {
    setSelection({ productId: product.id, index })
  }
  function step(offset: number) {
    setSelection((previous) => ({
      productId: product.id,
      index: ((previous.productId === product.id && previous.index < images.length ? previous.index : 0) + offset + images.length) % images.length
    }))
  }

  if (!current) {
    return (
      <div className="marketplaceGallery marketplaceGalleryEmpty" role="img" aria-label={`${product.name} image not added`}>
        <SafeCatalogImage src="" alt={product.name} loading="eager" />
      </div>
    )
  }

  const currentSprite = catalogSpriteImage(current.url)
  const currentSrc = currentSprite?.url || catalogImageVariant(current.url, "main")
  const zoomSrc = currentSprite ? currentSrc : catalogImageVariant(current.url, "zoom")

  return (
    <div className="marketplaceGallery">
      <div className="marketplaceGalleryStage">
        <SafeCatalogImage
          key={`${product.id}:${current.url}`}
          className={currentSprite ? "marketplaceGallerySprite" : "marketplaceGalleryPhoto"}
          src={currentSrc}
          fallbackSrc={current.fallbackUrl}
          srcSet={zoomSrc !== currentSrc ? `${currentSrc} 900w, ${zoomSrc} 1600w` : undefined}
          sizes="(max-width: 700px) 100vw, 50vw"
          objectPosition={currentSprite?.backgroundPosition}
          alt={current.alt || product.name}
          loading="eager"
          fetchPriority="high"
        />
        {badge && <span className={`marketplaceProductBadge marketplaceProductBadge--${badge.kind}`}>{badge.label}</span>}
        {images.length > 1 && <>
          <button className="marketplaceGalleryArrow previous" type="button" aria-label="Previous image" onClick={() => step(-1)}>‹</button>
          <button className="marketplaceGalleryArrow next" type="button" aria-label="Next image" onClick={() => step(1)}>›</button>
          <span className="marketplaceGalleryCount" aria-live="polite">{active + 1} / {images.length}</span>
        </>}
      </div>
      {images.length > 1 && (
        <div className="marketplaceGalleryThumbs" aria-label="Product images">
          {images.map((image, index) => {
            const sprite = catalogSpriteImage(image.url)
            return (
              <button
                type="button"
                key={image.url}
                className={index === active ? "active" : ""}
                aria-label={`View image ${index + 1} of ${images.length}`}
                aria-pressed={index === active}
                onClick={() => select(index)}
              >
                <SafeCatalogImage
                  className={sprite ? "marketplaceGalleryThumbSprite" : undefined}
                  src={sprite?.url || catalogImageVariant(image.url, "thumb")}
                  fallbackSrc={image.fallbackUrl}
                  objectPosition={sprite?.backgroundPosition}
                  alt={image.alt || product.name}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
