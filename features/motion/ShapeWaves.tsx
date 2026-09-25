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
    let startTimer = 0
    let running = false
    let visible = true
    let lastFrame = 0
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches
    const dpr = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : 1.5)
    const frameInterval = 1000 / (coarsePointer ? 18 : 32)

    function measure() {
      const rect = canvas.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.round(rect.width))
      const nextHeight = Math.max(1, Math.round(rect.height))
      if (nextWidth === width && nextHeight === height && canvas.width && canvas.height) return false
      width = nextWidth
      height = nextHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return true
    }

    function draw(now: number, staticFrame = false) {
      if (!width || !height) measure()
      ctx.clearRect(0, 0, width, height)
      const t = reduced || staticFrame ? 0 : now * 0.001
      const step = Math.max(coarsePointer ? 16 : 12, cellSize)
      const cols = Math.ceil(width / step) + 3
      const rows = Math.ceil(height / step) + 3
      const driftX = reduced || staticFrame ? 0 : Math.sin(t * (coarsePointer ? 0.26 : 0.38)) * step * (coarsePointer ? 0.9 : 1.45)

      for (let row = -2; row < rows; row++) {
        const y = row * step
        for (let col = -2; col < cols; col++) {
          const x = col * step + driftX
          const motion = coarsePointer ? 0.78 : 1
          const waveA = height * 0.28 + Math.sin(x * 0.021 + t * 1.02 * motion) * 28 + Math.sin(x * 0.007 - t * 0.66 * motion) * 18
          const waveB = height * 0.54 + Math.sin(x * 0.017 - t * 0.82 * motion + 1.7) * 31
          const waveC = height * 0.79 + Math.sin(x * 0.024 + t * 0.72 * motion + 3.2) * 23
          const distanceA = Math.abs(y - waveA)
          const distanceB = Math.abs(y - waveB)
          const distanceC = Math.abs(y - waveC)
          const nearest = Math.min(distanceA, distanceB, distanceC)
          if (nearest > step * 2.25) continue

          const band = nearest === distanceA ? 0 : nearest === distanceB ? 1 : 2
          const intensity = Math.max(0, 1 - nearest / (step * 2.25))
          const size = step * (0.3 + intensity * 0.46)
          ctx.globalAlpha = (coarsePointer ? 0.1 : 0.065) + intensity * (coarsePointer ? 0.23 : 0.21)
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
            ctx.rotate(staticFrame ? col * 0.03 : t * 0.1 + col * 0.03)
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

    function startMotion() {
      if (running || reduced) return
      running = true
      window.removeEventListener("scroll", startMotion)
      window.removeEventListener("pointerdown", startMotion)
      window.clearTimeout(startTimer)
      measure()
      draw(performance.now())
      raf = requestAnimationFrame(loop)
    }

    const resizeObserver = new ResizeObserver(() => {
      const changed = measure()
      if (changed && (running || reduced || !coarsePointer)) draw(performance.now(), !running)
    })
    resizeObserver.observe(canvas)

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible && (running || reduced || !coarsePointer)) draw(performance.now(), !running)
    }, { rootMargin: "100px" })
    intersectionObserver.observe(canvas)

    if (reduced) {
      raf = requestAnimationFrame(() => {
        measure()
        draw(0, true)
      })
    } else if (coarsePointer) {
      // Mobile-first: let text/actions paint first. CSS ambient motion remains visible,
      // then Shape Waves starts as soon as the user interacts (or after a quiet fallback).
      measure()
      window.addEventListener("scroll", startMotion, { passive: true, once: true })
      window.addEventListener("pointerdown", startMotion, { passive: true, once: true })
      startTimer = window.setTimeout(startMotion, 5500)
    } else {
      raf = requestAnimationFrame(() => {
        measure()
        startMotion()
      })
    }

    return () => {
      running = false
      window.clearTimeout(startTimer)
      window.removeEventListener("scroll", startMotion)
      window.removeEventListener("pointerdown", startMotion)
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [cellSize, color])

  return <canvas ref={canvasRef} className={`shapeWaves ${className}`.trim()} aria-hidden="true" />
}
