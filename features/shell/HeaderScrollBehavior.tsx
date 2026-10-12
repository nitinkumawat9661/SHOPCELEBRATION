"use client"

import { useEffect } from "react"

/**
 * The browser can change scrollY when this sticky header changes height.
 * Treating that layout correction as an upward swipe caused the header to
 * immediately reopen, followed by another collapse (visual jump/flicker).
 *
 * Only a real vertical touch, wheel, or keyboard gesture may change compact
 * mode. Horizontal gestures must never affect the navigation. At the top,
 * always show the complete header.
 */
export function HeaderScrollBehavior() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".celebrationHeader")
    if (!header) return
    const nav = header.querySelector<HTMLElement>(".celebrationNav")
    const search = header.querySelector<HTMLElement>(".celebrationSearch")
    // Present only on the homepage. Keep its document-flow height steady
    // while the sticky header folds search/navigation, avoiding Chrome jumps.
    const homeSpacer = document.querySelector<HTMLElement>(".celebrationHomeHeaderSpacer")
    const mobile = window.matchMedia("(max-width: 700px)")
    let previous = window.scrollY
    let collapsed = false
    let frame = 0
    let touchPosition: { x: number; y: number } | null = null
    let gestureDirection: "down" | "up" | null = null
    let gestureAt = 0
    let expandedHeight = 0

    function preserveHomeFlow() {
      if (!homeSpacer || typeof header!.getBoundingClientRect !== "function" || !("style" in homeSpacer)) return
      if (!mobile.matches) {
        expandedHeight = 0
        homeSpacer.style.height = "0px"
        return
      }
      const height = header!.getBoundingClientRect().height
      if (!collapsed && height > expandedHeight) expandedHeight = height
      // Header plus its sibling spacer always occupies the original expanded
      // height in the document. The sticky toolbar itself can still shrink.
      homeSpacer.style.height = `${Math.max(0, expandedHeight - height)}px`
    }

    function setCollapsed(value: boolean) {
      if (collapsed === value) return
      collapsed = value
      header!.setAttribute("data-compact-nav", value ? "true" : "false")
      // A visually hidden nav must not remain in the keyboard tab order.
      if (nav) nav.inert = value
      if (search) search.inert = value
      preserveHomeFlow()
    }

    function rememberDirection(direction: "down" | "up") {
      gestureDirection = direction
      gestureAt = performance.now()
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) { touchPosition = null; return }
      touchPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }

    function onTouchMove(event: TouchEvent) {
      if (!touchPosition || event.touches.length !== 1) return
      const next = { x: event.touches[0].clientX, y: event.touches[0].clientY }
      const dx = next.x - touchPosition.x
      const dy = next.y - touchPosition.y
      // Do not treat horizontal gallery/category gestures as header scroll.
      if (Math.abs(dy) >= 12 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        rememberDirection(dy < 0 ? "down" : "up")
        touchPosition = next
      }
    }

    function onWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) > 5 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        rememberDirection(event.deltaY > 0 ? "down" : "up")
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const element = event.target
      if (element instanceof HTMLElement && (element.isContentEditable || element.matches("input,textarea,select"))) return
      if (["ArrowDown", "PageDown"].includes(event.key) || (event.key === " " && !event.shiftKey)) rememberDirection("down")
      if (["ArrowUp", "PageUp"].includes(event.key) || (event.key === " " && event.shiftKey)) rememberDirection("up")
    }

    function sync() {
      frame = 0
      const y = window.scrollY
      const delta = y - previous
      const focusedInHeader = header!.contains(document.activeElement)
      // Do not use changes caused by CSS height/scroll anchoring as direction.
      const fromUser = gestureDirection && performance.now() - gestureAt < 900
      if (!mobile.matches || y < 110 || focusedInHeader) {
        setCollapsed(false)
      } else if (fromUser && gestureDirection === "down" && y > 180 && delta >= 5) {
        setCollapsed(true)
      } else if (fromUser && gestureDirection === "up" && delta <= -7) {
        setCollapsed(false)
      }
      previous = y
    }

    function onScroll() {
      if (frame) return
      frame = window.requestAnimationFrame(sync)
    }

    function onFocus() {
      gestureDirection = null
      setCollapsed(false)
    }

    function onViewportChange() {
      setCollapsed(false)
      expandedHeight = 0
      previous = window.scrollY
      preserveHomeFlow()
    }

    const headerResizeObserver = homeSpacer && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(preserveHomeFlow) : null
    headerResizeObserver?.observe(header)

    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("wheel", onWheel, { passive: true })
    document.addEventListener("keydown", onKeyDown)
    mobile.addEventListener("change", onViewportChange)
    window.addEventListener("resize", onViewportChange, { passive: true })
    header.addEventListener("focusin", onFocus)
    preserveHomeFlow()
    sync()

    return () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("wheel", onWheel)
      document.removeEventListener("keydown", onKeyDown)
      mobile.removeEventListener("change", onViewportChange)
      window.removeEventListener("resize", onViewportChange)
      header.removeEventListener("focusin", onFocus)
      if (frame) window.cancelAnimationFrame(frame)
      setCollapsed(false)
      headerResizeObserver?.disconnect()
      if (homeSpacer && "style" in homeSpacer) homeSpacer.style.height = "0px"
      header.removeAttribute("data-compact-nav")
    }
  }, [])
  return null
}
