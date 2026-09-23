"use client"

import { useEffect, useRef, useState } from "react"

export type UxTone = "success" | "error" | "info"

type UxMessage = {
  id: number
  title: string
  body?: string
  tone: UxTone
  durationMs: number
}

type UxMessageInput = {
  title: string
  body?: string
  tone?: UxTone
  durationMs?: number
}

const UX_EVENT = "celebration:ux-message"

export function notifyUx(input: UxMessageInput) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<UxMessageInput>(UX_EVENT, { detail: input }))
}

export function scrollToUxTarget(target: Element | null, block: ScrollLogicalPosition = "center") {
  if (!target || typeof window === "undefined") return
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block })
}

export function focusCheckoutField(field: string) {
  if (typeof document === "undefined") return
  const target = document.querySelector<HTMLElement>(`[data-checkout-field="${field}"]`)
  if (!target) return
  scrollToUxTarget(target, "center")
  window.setTimeout(() => target.focus({ preventScroll: true }), 260)
}

export function UxMessenger() {
  const [message, setMessage] = useState<UxMessage | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    function onMessage(event: Event) {
      const detail = (event as CustomEvent<UxMessageInput>).detail
      if (!detail?.title) return
      if (timer.current) window.clearTimeout(timer.current)
      const next: UxMessage = {
        id: Date.now(),
        title: detail.title,
        body: detail.body,
        tone: detail.tone || "info",
        durationMs: detail.durationMs || 3200
      }
      setMessage(next)
      timer.current = window.setTimeout(() => setMessage(null), next.durationMs)
    }

    window.addEventListener(UX_EVENT, onMessage)
    return () => {
      window.removeEventListener(UX_EVENT, onMessage)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  if (!message) return null

  return (
    <div className="uxToastViewport" aria-live="polite" aria-atomic="true">
      <div className={`uxToast uxToast-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
        <div className="uxToastMark" aria-hidden="true">{message.tone === "success" ? "✓" : message.tone === "error" ? "!" : "i"}</div>
        <div className="uxToastCopy"><strong>{message.title}</strong>{message.body && <span>{message.body}</span>}</div>
        <button type="button" onClick={() => setMessage(null)} aria-label="Message close karein">×</button>
      </div>
    </div>
  )
}
