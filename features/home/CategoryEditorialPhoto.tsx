"use client"

import { useState } from "react"
import { responsivePublicCatalogImage } from "../../lib/domain/catalog-image-performance"

/** Fixed-size, immediately rendered WebP: no hydration opacity animation or layout jump. */
export function CategoryEditorialPhoto({ src, label, eager = false }: {
  src: string
  label: string
  eager?: boolean
}) {
  const [brokenSource, setBrokenSource] = useState("")
  const responsive = responsivePublicCatalogImage(src, "category")
  // A resized image failure falls back to the owner's original SAME category
  // photo; only then do we show the letter placeholder.
  const showOriginal = brokenSource === `${src}:optimized`
  const failed = brokenSource === `${src}:original`
  return (
    <span className="celebrationCategoryEditorialPhoto">
      <span className="celebrationCategoryPhotoFallback" aria-hidden="true">{label.charAt(0)}</span>
      {!failed && (
        <img
          src={showOriginal ? src : responsive?.src || src}
          srcSet={showOriginal ? undefined : responsive?.srcSet}
          sizes={showOriginal ? undefined : responsive?.sizes}
          width={640}
          height={640}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          alt={`Celebration product photography for ${label}; explore actual items`}
          onError={() => setBrokenSource(responsive && !showOriginal ? `${src}:optimized` : `${src}:original`)}
        />
      )}
    </span>
  )
}
