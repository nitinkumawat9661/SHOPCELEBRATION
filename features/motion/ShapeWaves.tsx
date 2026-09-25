"use client"

import { useEffect, useRef } from "react"

type ShapeWavesProps = {
  className?: string
  color?: string
  cellSize?: number
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const h = size * 0.88
  ctx.beginPath()
  ctx.moveTo(x, y - h / 2)
  ctx.lineTo(x - size / 2, y + h / 2)
  ctx.lineTo(x + size / 2, y + h / 2)
  ctx.closePath()
  ctx.fill()
}

export function ShapeWaves({ className = "", color = "#8b2529", cellSize = 12 }: ShapeWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const currentCanvas = canvasRef.current
    if (!currentCanvas) return
    const canvas: HTMLCanvasElement = currentCanvas
    const context = canvas.getContext("2d", { alpha: true })
    if (!context) return
    const ctx: CanvasRenderingContext2D = context

    let width = 0
    let height = 0
    let raf = 0
    let running = false
    let visible = true
    let lastFrame = 0
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches
    const dpr = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.15 : 1.5)
    const frameInterval = 1000 / (coarsePointer ? 20 : 32)

    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(performance.now())
    }

    function draw(now: number) {
      ctx.clearRect(0, 0, width, height)
      const t = reduced ? 0 : now * 0.001
      const step = Math.max(coarsePointer ? 14 : 12, cellSize)
      const cols = Math.ceil(width / step) + 3
      const rows = Math.ceil(height / step) + 3
      const driftX = reduced ? 0 : Math.sin(t * 0.38) * step * 1.45

      for (let row = -2; row < rows; row++) {
        const y = row * step
        for (let col = -2; col < cols; col++) {
          const x = col * step + driftX
          const mobileBoost = coarsePointer ? 1.12 : 1
          const waveA = height * 0.28 + Math.sin(x * 0.021 + t * 1.02) * 28 * mobileBoost + Math.sin(x * 0.007 - t * 0.66) * 18
          const waveB = height * 0.54 + Math.sin(x * 0.017 - t * 0.82 + 1.7) * 31 * mobileBoost
          const waveC = height * 0.79 + Math.sin(x * 0.024 + t * 0.72 + 3.2) * 23 * mobileBoost
          const distanceA = Math.abs(y - waveA)
          const distanceB = Math.abs(y - waveB)
          const distanceC = Math.abs(y - waveC)
          const nearest = Math.min(distanceA, distanceB, distanceC)
          if (nearest > step * 2.25) continue

          const band = nearest === distanceA ? 0 : nearest === distanceB ? 1 : 2
          const intensity = Math.max(0, 1 - nearest / (step * 2.25))
          const size = step * (0.3 + intensity * 0.46)
          ctx.globalAlpha = (coarsePointer ? 0.085 : 0.065) + intensity * (coarsePointer ? 0.26 : 0.21)
          ctx.fillStyle = color

          if (band === 0) {
            drawTriangle(ctx, x, y, size)
          } else if (band === 1) {
            ctx.beginPath()
            ctx.arc(x, y, size * 0.47, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(t * 0.1 + col * 0.03)
            ctx.fillRect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84)
            ctx.restore()
          }
        }
      }
      ctx.globalAlpha = 1
    }

    function loop(now: number) {
      if (!running) return
      if (visible && !document.hidden && now - lastFrame >= frameInterval) {
        lastFrame = now
        draw(now)
      }
      raf = requestAnimationFrame(loop)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible) draw(performance.now())
    }, { rootMargin: "100px" })
    intersectionObserver.observe(canvas)

    resize()
    if (!reduced) {
      running = true
      raf = requestAnimationFrame(loop)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [cellSize, color])

  return <canvas ref={canvasRef} className={`shapeWaves ${className}`.trim()} aria-hidden="true" />
}
