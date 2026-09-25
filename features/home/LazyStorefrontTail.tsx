"use client"

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react"
import type { useHamperBuilder } from "../builder/useHamperBuilder"

type StoreState = ReturnType<typeof useHamperBuilder>
type TailProps = {
  state: StoreState
  builderActive: boolean
  onBuild: (step?: number) => void
}
type TailComponent = ComponentType<TailProps>

export function LazyStorefrontTail(props: TailProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
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

    const target = sentinelRef.current
    if (!target || Tail) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      observer.disconnect()
      void loadTail()
    }, { rootMargin: "120px 0px" })
    observer.observe(target)

    return () => observer.disconnect()
  }, [props.builderActive, Tail, loadTail])

  if (Tail) return <Tail {...props} />

  return (
    <div ref={sentinelRef} className="storefrontTailPlaceholder" aria-hidden="true">
      <div className="wrap storefrontTailPlaceholderInner" />
    </div>
  )
}
