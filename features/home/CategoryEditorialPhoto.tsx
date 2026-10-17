"use client"

import Image from "next/image"
import { useState } from "react"

/**
 * Owner-approved category-v7 art is 640×640 in R2, but the circular nav is
 * ~187×187 in Lighthouse's mobile render. Next/Image makes cached, responsive
 * WebPs from the EXACT same public source; never replace, crop or republish it.
 * If the image optimizer is unavailable, retry the ORIGINAL owned source.
 */
export function CategoryEditorialPhoto({ src, label, eager = false }: {
  src: string
  label: string
  eager?: boolean
}) {
  const [brokenSource, setBrokenSource] = useState("")
  const [originalSource, setOriginalSource] = useState("")
  const failed = brokenSource === src
  const useOriginal = originalSource === src

  return (
    <span className="celebrationCategoryEditorialPhoto">
      <span className="celebrationCategoryPhotoFallback" aria-hidden="true">{label.charAt(0)}</span>
      {!failed && (
        <Image
          key={`${src}:${useOriginal ? "original" : "optimized"}`}
          src={src}
          width={640}
          height={640}
          sizes="(max-width: 700px) 188px, (max-width: 1100px) 200px, 256px"
          quality={70}
          unoptimized={useOriginal}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          alt={`Celebration product photography for ${label}; explore actual items`}
          onError={() => {
            if (!useOriginal) setOriginalSource(src)
            else setBrokenSource(src)
          }}
        />
      )}
    </span>
  )
}
