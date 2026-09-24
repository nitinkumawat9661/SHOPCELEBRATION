"use client"

import { type ButtonHTMLAttributes, type PointerEvent, type ReactNode, useRef } from "react"

type TiltTierButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode
  rotationFactor?: number
}

export function TiltTierButton({ children, className = "", rotationFactor = 11, ...props }: TiltTierButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)

  function move(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    const rotateX = -((py - 0.5) * 2 * rotationFactor)
    const rotateY = (px - 0.5) * 2 * rotationFactor
    node.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`)
    node.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`)
    node.style.setProperty("--shine-x", `${(px * 100).toFixed(1)}%`)
    node.style.setProperty("--shine-y", `${(py * 100).toFixed(1)}%`)
  }

  function reset() {
    const node = ref.current
    if (!node) return
    node.style.setProperty("--tilt-x", "0deg")
    node.style.setProperty("--tilt-y", "0deg")
  }

  return (
    <button
      {...props}
      ref={ref}
      className={`tiltSurface ${className}`.trim()}
      onPointerMove={(event) => { move(event); props.onPointerMove?.(event) }}
      onPointerLeave={(event) => { reset(); props.onPointerLeave?.(event) }}
      onPointerCancel={(event) => { reset(); props.onPointerCancel?.(event) }}
    >
      <span className="tiltSurfaceShine" aria-hidden="true" />
      <span className="tiltSurfaceContent">{children}</span>
    </button>
  )
}

type SpotlightCardProps = {
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function SpotlightCard({ children, className = "", ariaLabel }: SpotlightCardProps) {
  const ref = useRef<HTMLElement>(null)

  function move(event: PointerEvent<HTMLElement>) {
    const node = ref.current
    if (!node || event.pointerType === "touch") return
    const rect = node.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    node.style.setProperty("--spot-x", `${x.toFixed(1)}%`)
    node.style.setProperty("--spot-y", `${y.toFixed(1)}%`)
  }

  return (
    <article ref={ref} className={`premiumSpotlight ${className}`.trim()} aria-label={ariaLabel} onPointerMove={move}>
      <span className="premiumSpotlightGlow" aria-hidden="true" />
      <div className="premiumSpotlightContent">{children}</div>
    </article>
  )
}
