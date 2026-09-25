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
    const dpr = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.45 : 1.75)
    const frameInterval = 1000 / (coarsePointer ? 28 : 40)

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
      const step = Math.max(coarsePointer ? 9 : 10, cellSize)
      const cols = Math.ceil(width / step) + 3
      const rows = Math.ceil(height / step) + 3
      const driftX = reduced ? 0 : Math.sin(t * 0.42) * step * 1.7

      for (let row = -2; row < rows; row++) {
        const y = row * step
        for (let col = -2; col < cols; col++) {
          const x = col * step + driftX
          const mobileBoost = coarsePointer ? 1.18 : 1
          const waveA = height * 0.28 + Math.sin(x * 0.021 + t * 1.12) * 28 * mobileBoost + Math.sin(x * 0.007 - t * 0.74) * 18
          const waveB = height * 0.54 + Math.sin(x * 0.017 - t * 0.92 + 1.7) * 31 * mobileBoost
          const waveC = height * 0.79 + Math.sin(x * 0.024 + t * 0.82 + 3.2) * 23 * mobileBoost
          const distances = [Math.abs(y - waveA), Math.abs(y - waveB), Math.abs(y - waveC)]
          const nearest = Math.min(...distances)
          if (nearest > step * 2.35) continue

          const band = distances.indexOf(nearest)
          const intensity = Math.max(0, 1 - nearest / (step * 2.35))
          const size = step * (0.3 + intensity * 0.48)
          ctx.globalAlpha = (coarsePointer ? 0.1 : 0.075) + intensity * (coarsePointer ? 0.3 : 0.23)
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
            ctx.rotate(t * 0.12 + col * 0.03)
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
    }, { rootMargin: "160px" })
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
