"use client"

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react"
import type { useHamperBuilder } from "./useHamperBuilder"

type BuilderState = ReturnType<typeof useHamperBuilder>
type BuilderComponent = ComponentType<{ state: BuilderState }>

export function LazyHamperBuilder({ state, active = false }: { state: BuilderState; active?: boolean }) {
  const placeholderRef = useRef<HTMLElement>(null)
  const loadingRef = useRef<Promise<void> | null>(null)
  const [Builder, setBuilder] = useState<BuilderComponent | null>(null)

  const loadBuilder = useCallback(() => {
    if (Builder || loadingRef.current) return loadingRef.current
    loadingRef.current = import("./HamperBuilder").then((mod) => {
      setBuilder(() => mod.HamperBuilder)
    }).finally(() => {
      loadingRef.current = null
    })
    return loadingRef.current
  }, [Builder])

  useEffect(() => {
    if (active) {
      void loadBuilder()
      return
    }
    const target = placeholderRef.current
    if (!target || Builder) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      observer.disconnect()
      void loadBuilder()
    }, { rootMargin: "220px 0px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [active, Builder, loadBuilder])

  if (Builder) return <Builder state={state} />

  return (
    <section ref={placeholderRef} id="builder" className="builder lazyBuilderPlaceholder" aria-label="Hamper builder">
      <div className="wrap">
        <div className="lazyBuilderCard" aria-hidden="true">
          <span />
          <strong>Build your hamper</strong>
          <small>Your builder will be ready as you reach this section.</small>
        </div>
      </div>
    </section>
  )
}
