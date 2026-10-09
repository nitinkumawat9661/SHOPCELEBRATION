"use client"

import { useState } from "react"

export const CATALOG_IMAGE_FALLBACK = "/images/celebration-product-placeholder.svg"

type CatalogImageProps = {
  src: string
  alt: string
  className?: string
  loading?: "eager" | "lazy"
  fetchPriority?: "high" | "low" | "auto"
  sizes?: string
  srcSet?: string
}

export function SafeCatalogImage({ src, alt, className, loading = "lazy", fetchPriority, sizes, srcSet }: CatalogImageProps) {
  const [failedSource, setFailedSource] = useState("")
  const failed = !src || failedSource === src
  return <img
    src={failed ? CATALOG_IMAGE_FALLBACK : src}
    srcSet={failed ? undefined : srcSet}
    sizes={failed ? undefined : sizes}
    alt={failed ? `${alt} — image unavailable` : alt}
    className={className}
    loading={loading}
    decoding="async"
    fetchPriority={fetchPriority}
    referrerPolicy="no-referrer"
    onError={failed ? undefined : () => setFailedSource(src)}
  />
}
