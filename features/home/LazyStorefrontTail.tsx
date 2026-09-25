"use client"

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react"
import type { CatalogConfig } from "../../lib/domain/catalog"

type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

type TailProps = {
  catalog: CatalogConfig
  socialProof: TierSocialProof | null
  selectedTierId: string
  occasion: string
  builderActive: boolean
  requestedStep: number
  requestVersion: number
  onBuild: (step?: number) => void
  onSelectionSync: (tierId: string, occasion: string) => void
}

type TailComponent = ComponentType<TailProps>

const DEFERRED_HASHES = new Set(["#products", "#builder", "#custom-request", "#trust"])

export function LazyStorefrontTail(props: TailProps) {
  const loadingRef = useRef<Promise<void> | null>(null)
  const [Tail, setTail] = useState<TailComponent | null>(null)

  const loadTail = useCallback(() => {
    if (Tail || loadingRef.current) return loadingRef.current
    loadingRef.current = import("./StorefrontTail").then((mod) => {
      setTail(() => mod.StorefrontTail)
    }).finally(() => {
      loadingRef.current = null
    })
    return loadingRef.current
  }, [Tail])

  useEffect(() => {
    if (props.builderActive) {
      void loadTail()
      return
    }
    if (Tail) return

    let done = false
    const trigger = () => {
      if (done) return
      done = true
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("hashchange", onHashChange)
      void loadTail()
    }
    const onScroll = () => {
      if (window.scrollY >= 120) trigger()
    }
    const onHashChange = () => {
      if (DEFERRED_HASHES.has(window.location.hash)) trigger()
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("hashchange", onHashChange)
    onHashChange()
    onScroll()

    return () => {
      done = true
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("hashchange", onHashChange)
    }
  }, [props.builderActive, Tail, loadTail])

  if (Tail) return <Tail {...props} />

  return (
    <div className="storefrontTailPlaceholder" aria-hidden="true">
      <div className="wrap storefrontTailPlaceholderInner">
        <span />
      </div>
    </div>
  )
}
