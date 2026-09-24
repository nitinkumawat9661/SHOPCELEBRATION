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

export function ShapeWaves({ className = "", color = "#8b2529", cellSize = 14 }: ShapeWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let width = 0
    let height = 0
    let raf = 0
    let running = false
    let visible = true
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)

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
      const step = Math.max(10, cellSize)
      const cols = Math.ceil(width / step) + 2
      const rows = Math.ceil(height / step) + 2

      for (let row = -1; row < rows; row++) {
        const y = row * step
        for (let col = -1; col < cols; col++) {
          const x = col * step
          const waveA = height * 0.34 + Math.sin(x * 0.018 + t * 0.9) * 22 + Math.sin(x * 0.006 - t * 0.55) * 15
          const waveB = height * 0.57 + Math.sin(x * 0.015 - t * 0.72 + 1.7) * 24
          const waveC = height * 0.78 + Math.sin(x * 0.021 + t * 0.64 + 3.2) * 18
          const distances = [Math.abs(y - waveA), Math.abs(y - waveB), Math.abs(y - waveC)]
          const nearest = Math.min(...distances)
          if (nearest > step * 2.1) continue

          const band = distances.indexOf(nearest)
          const intensity = Math.max(0, 1 - nearest / (step * 2.1))
          const size = step * (0.26 + intensity * 0.42)
          ctx.globalAlpha = 0.055 + intensity * 0.14
          ctx.fillStyle = color

          if (band === 0) {
            drawTriangle(ctx, x, y, size)
          } else if (band === 1) {
            ctx.beginPath()
            ctx.arc(x, y, size * 0.46, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.fillRect(x - size * 0.42, y - size * 0.42, size * 0.84, size * 0.84)
          }
        }
      }
      ctx.globalAlpha = 1
    }

    function loop(now: number) {
      if (!running) return
      if (visible && !document.hidden) draw(now)
      raf = requestAnimationFrame(loop)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible) draw(performance.now())
    }, { rootMargin: "120px" })
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
