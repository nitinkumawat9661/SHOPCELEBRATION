"use client"

import { useState } from "react"

export const CATALOG_IMAGE_FALLBACK = "/images/celebration-product-placeholder.svg"

type CatalogImageProps = {
  src: string
  /** Must refer to the ORIGINAL SAME-PRODUCT image, never a generic image. */
  fallbackSrc?: string
  alt: string
  className?: string
  loading?: "eager" | "lazy"
  fetchPriority?: "high" | "low" | "auto"
  sizes?: string
  srcSet?: string
}

export function SafeCatalogImage({ src, fallbackSrc, alt, className, loading = "lazy", fetchPriority, sizes, srcSet }: CatalogImageProps) {
  // Source identity includes the original fallback URL, preventing a failure
  // from product A accidentally affecting product B or another gallery image.
  const sources = [src, fallbackSrc, CATALOG_IMAGE_FALLBACK].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  )
  const sourceKey = JSON.stringify([src, fallbackSrc])
  const [failure, setFailure] = useState<{ key: string; index: number } | null>(null)
  const currentIndex = failure?.key === sourceKey ? Math.min(failure.index, sources.length - 1) : 0
  const currentSrc = sources[currentIndex]
  const original = currentIndex === 0 && currentSrc === src
  return <img
    src={currentSrc}
    srcSet={original ? srcSet : undefined}
    sizes={original ? sizes : undefined}
    alt={currentSrc === CATALOG_IMAGE_FALLBACK ? `${alt} — image unavailable` : alt}
    className={className}
    loading={loading}
    decoding="async"
    fetchPriority={fetchPriority}
    referrerPolicy="no-referrer"
    onError={currentIndex < sources.length - 1 ? () => setFailure({ key: sourceKey, index: currentIndex + 1 }) : undefined}
  />
}
