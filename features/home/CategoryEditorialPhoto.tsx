"use client"

import { useState } from "react"

/** Fixed-size, immediately rendered WebP: no hydration opacity animation or layout jump. */
export function CategoryEditorialPhoto({ src, label, eager = false }: {
  src: string
  label: string
  eager?: boolean
}) {
  const [brokenSource, setBrokenSource] = useState("")
  const failed = brokenSource === src
  return (
    <span className="celebrationCategoryEditorialPhoto">
      <span className="celebrationCategoryPhotoFallback" aria-hidden="true">{label.charAt(0)}</span>
      {!failed && (
        <img
          src={src}
          width={640}
          height={640}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          alt={`Celebration product photography for ${label}; explore actual items`}
          onError={() => setBrokenSource(src)}
        />
      )}
    </span>
  )
}
