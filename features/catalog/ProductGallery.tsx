"use client"

import { useMemo, useState } from "react"
import { catalogImageVariant, catalogSpriteImage, productImages, type GiftProduct } from "../../lib/domain/catalog"
import { SafeCatalogImage } from "./SafeCatalogImage"

export function ProductGallery({ product }: { product: GiftProduct }) {
  const images = useMemo(() => productImages(product), [product])
  const [active, setActive] = useState(0)
  const current = images[active] || images[0]

  if (!current) {
    return (
      <div className="marketplaceGallery marketplaceGalleryEmpty" role="img" aria-label={`${product.name} image not added`}>
        <SafeCatalogImage src="" alt={product.name} />
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
        /> : <SafeCatalogImage
          src={catalogImageVariant(current.url, "main")}
          fallbackSrc={current.fallbackUrl}
          srcSet={catalogImageVariant(current.url, "zoom") !== current.url
            ? `${catalogImageVariant(current.url, "main")} 900w, ${catalogImageVariant(current.url, "zoom")} 1600w`
            : undefined}
          sizes="(max-width: 700px) 100vw, 50vw"
          alt={current.alt || product.name}
          loading="eager"
          fetchPriority="high"
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
              /> : <SafeCatalogImage src={catalogImageVariant(image.url, "thumb")} alt={image.alt || product.name} loading={index === 0 ? "eager" : "lazy"} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
