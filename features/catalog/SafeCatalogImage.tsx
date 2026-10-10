"use client"

import { useEffect, useRef, useState } from "react"

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
  /** For verified five-frame catalog sprites, crop the real source image in an img. */
  objectPosition?: string
}

type ImageCandidate = {
  url: string
  srcSet?: string
  sizes?: string
}

type ImageAttempt = {
  key: string
  index: number
  ready: boolean
  failed: boolean
}

/** Each fallback is the ORIGINAL image of this exact product, not another SKU.
 * If a srcSet derivative breaks but the main image exists, try the main image
 * alone before considering the original same-photo fallback. */
function imageCandidates(src: string, fallbackSrc?: string, srcSet?: string, sizes?: string): ImageCandidate[] {
  const primary = src.trim()
  const original = fallbackSrc?.trim() || ""
  const candidates: ImageCandidate[] = []
  if (primary) {
    if (srcSet?.trim()) candidates.push({ url: primary, srcSet: srcSet.trim(), sizes })
    candidates.push({ url: primary })
  }
  if (original && original !== primary) candidates.push({ url: original })
  candidates.push({ url: CATALOG_IMAGE_FALLBACK })
  return candidates
}

export function SafeCatalogImage({
  src, fallbackSrc, alt, className, loading = "lazy", fetchPriority, sizes, srcSet, objectPosition
}: CatalogImageProps) {
  const candidates = imageCandidates(src, fallbackSrc, srcSet, sizes)
  const sourceKey = JSON.stringify([src, fallbackSrc, srcSet, sizes])
  const [attempt, setAttempt] = useState<ImageAttempt>({ key: sourceKey, index: 0, ready: false, failed: false })
  const latestKey = useRef(sourceKey)
  const imageRef = useRef<HTMLImageElement>(null)
  latestKey.current = sourceKey

  // A new SKU/image must render its FIRST OWN photo immediately, even if a
  // previous gallery image was loading, decoding or in fallback mode.
  const current = attempt.key === sourceKey ? attempt : { key: sourceKey, index: 0, ready: false, failed: false }
  const index = Math.min(current.index, candidates.length - 1)
  const candidate = candidates[index]
  const isBranded = candidate.url === CATALOG_IMAGE_FALLBACK

  const failCurrent = (key: string, failedIndex: number, node: HTMLImageElement) => {
    if (latestKey.current !== key || imageRef.current !== node) return
    setAttempt((previous) => {
      if (latestKey.current !== key) return previous
      const active = previous.key === key ? previous : { key, index: 0, ready: false, failed: false }
      if (active.index !== failedIndex || active.ready || active.failed) return previous
      if (failedIndex === candidates.length - 1) return { key, index: failedIndex, ready: false, failed: true }
      return { key, index: failedIndex + 1, ready: false, failed: false }
    })
  }

  const markReady = async (node: HTMLImageElement, key: string, readyIndex: number) => {
    try {
      // onLoad can fire before the decoded frame is actually paintable.
      if (typeof node.decode === "function") await node.decode()
      if (!node.naturalWidth || !node.naturalHeight) throw new Error("IMAGE_HAS_NO_PIXELS")
    } catch {
      failCurrent(key, readyIndex, node)
      return
    }
    if (latestKey.current !== key || imageRef.current !== node) return
    setAttempt((previous) => {
      if (latestKey.current !== key) return previous
      const active = previous.key === key ? previous : { key, index: 0, ready: false, failed: false }
      if (active.index !== readyIndex || active.failed) return previous
      return { key, index: readyIndex, ready: true, failed: false }
    })
  }

  useEffect(() => {
    if (current.ready || current.failed) return
    const node = imageRef.current
    if (!node) return
    // A previously cached image can finish before React's event handler binds.
    if (node.complete && node.naturalWidth > 0) {
      void markReady(node, sourceKey, index)
      return
    }
    // A stalled R2/CDN request may never emit onError. Keep an always-visible
    // branded HTML layer and advance after a bounded attempt rather than
    // leaving a blank white loading box forever.
    const timer = window.setTimeout(() => {
      failCurrent(sourceKey, index, node)
    }, index === 0 ? 16000 : 10000)
    return () => window.clearTimeout(timer)
    // Event handlers/refs are deliberately limited to this image attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, index, current.ready, current.failed])

  return (
    <span
      className={["safeCatalogImageFrame", className].filter(Boolean).join(" ")}
      data-image-state={current.ready ? "ready" : current.failed ? "unavailable" : "loading"}
      data-image-source={isBranded ? "branded" : "product"}
    >
      <span className="safeCatalogImagePlaceholder" aria-hidden="true">
        <span className="safeCatalogImageMonogram">C</span>
        <span className="safeCatalogImageBrand">Celebration</span>
        <span className="safeCatalogImageHint">{isBranded ? "Photo temporarily unavailable" : "Loading product photo"}</span>
      </span>
      <img
        key={`${sourceKey}:${index}`}
        ref={imageRef}
        src={candidate.url}
        srcSet={candidate.srcSet}
        sizes={candidate.sizes}
        alt={isBranded ? `${alt} — image unavailable` : alt}
        width={800}
        height={800}
        loading={isBranded ? "eager" : loading}
        decoding="async"
        fetchPriority={isBranded ? "auto" : fetchPriority}
        referrerPolicy="no-referrer"
        style={objectPosition ? { objectPosition, objectFit: "cover" } : undefined}
        onLoad={(event) => { void markReady(event.currentTarget, sourceKey, index) }}
        onError={(event) => failCurrent(sourceKey, index, event.currentTarget)}
      />
    </span>
  )
}
