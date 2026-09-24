"use client"

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  threshold?: number
}

export function Reveal({ children, className = "", delay = 0, threshold = 0.12 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { threshold, rootMargin: "0px 0px -7% 0px" })

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  const style = { "--reveal-delay": `${Math.max(0, delay)}ms` } as CSSProperties
  return <div ref={ref} className={`motionReveal ${className}`.trim()} data-visible={visible ? "true" : "false"} style={style}>{children}</div>
}
