"use client"

import { useMemo, useState } from "react"
import { productImages, type GiftProduct } from "../../lib/domain/catalog"

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

  return (
    <div className="marketplaceGallery">
      <div className="marketplaceGalleryStage">
        <img
          src={current.url}
          alt={current.alt || product.name}
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
        />
        {product.badge && <span className="marketplaceProductBadge">{product.badge}</span>}
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
              <img src={image.url} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
