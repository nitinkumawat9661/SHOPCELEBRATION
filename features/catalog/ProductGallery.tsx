"use client"

import { useMemo, useState } from "react"
import { catalogSpriteImage, productImages, type GiftProduct } from "../../lib/domain/catalog"

export function ProductGallery({ product }: { product: GiftProduct }) {
  const images = useMemo(() => productImages(product), [product])
  const [active, setActive] = useState(0)
  const current = images[active] || images[0]

  if (!current) {
    return (
      <div className="marketplaceGallery marketplaceGalleryEmpty" role="img" aria-label={`${product.name} image not added`}>
        <span aria-hidden="true">{product.icon || "✦"}</span>
        <small>Product image coming soon</small>
      </div>
    )
  }

  const currentSprite = catalogSpriteImage(current.url)

  return (
    <div className="marketplaceGallery">
      <div className="marketplaceGalleryStage">
        {currentSprite ? <div
          className="marketplaceGallerySprite"
          role="img"
          aria-label={current.alt || product.name}
          style={{ backgroundImage: `url("${currentSprite.url}")`, backgroundPosition: currentSprite.backgroundPosition }}
        /> : <img
          src={current.url}
          alt={current.alt || product.name}
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
        />}
        {product.badge && <span className="marketplaceProductBadge">{product.badge}</span>}
        {images.length > 1 && <>
          <button className="marketplaceGalleryArrow previous" type="button" aria-label="Previous image" onClick={() => setActive((currentIndex) => (currentIndex - 1 + images.length) % images.length)}>‹</button>
          <button className="marketplaceGalleryArrow next" type="button" aria-label="Next image" onClick={() => setActive((currentIndex) => (currentIndex + 1) % images.length)}>›</button>
          <span className="marketplaceGalleryCount" aria-live="polite">{active + 1} / {images.length}</span>
        </>}
      </div>

      {images.length > 1 && (
        <div className="marketplaceGalleryThumbs" aria-label="Product images">
          {images.map((image, index) => (
            <button
              type="button"
              key={image.url}
              className={index === active ? "active" : ""}
              aria-label={`View image ${index + 1} of ${images.length}`}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
            >
              {catalogSpriteImage(image.url) ? <span
                className="marketplaceGalleryThumbSprite"
                aria-hidden="true"
                style={{
                  backgroundImage: `url("${catalogSpriteImage(image.url)!.url}")`,
                  backgroundPosition: catalogSpriteImage(image.url)!.backgroundPosition
                }}
              /> : <img src={image.url} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
