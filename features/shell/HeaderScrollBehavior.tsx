"use client"

import { useEffect } from "react"

/**
 * On small screens the six-item nav and search area take valuable viewport
 * space. Collapse them while moving down the product list, restore when
 * scrolling up / returning to the top / focusing a header control.
 * Nothing is removed from the DOM or its link destinations.
 */
export function HeaderScrollBehavior() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".celebrationHeader")
    if (!header) return
    const nav = header.querySelector<HTMLElement>(".celebrationNav")
    const search = header.querySelector<HTMLElement>(".celebrationSearch")
    const mobile = window.matchMedia("(max-width: 700px)")
    let previous = window.scrollY
    let collapsed = false
    let frame = 0

    function setCollapsed(value: boolean) {
      if (collapsed === value) return
      collapsed = value
      header?.setAttribute("data-compact-nav", value ? "true" : "false")
      // A hidden nav must also disappear from keyboard tab order.
      if (nav) nav.inert = value
      if (search) search.inert = value
    }

    function sync() {
      frame = 0
      const y = window.scrollY
      const delta = y - previous
      const focusedInHeader = header?.contains(document.activeElement)
      if (!mobile.matches || y < 110 || focusedInHeader) {
        setCollapsed(false)
      } else if (y > 180 && delta >= 5) {
        setCollapsed(true)
      } else if (delta <= -7) {
        setCollapsed(false)
      }
      previous = y
    }
    function onScroll() {
      if (frame) return
      frame = window.requestAnimationFrame(sync)
    }
    function onFocus() { setCollapsed(false) }
    window.addEventListener("scroll", onScroll, { passive: true })
    mobile.addEventListener("change", sync)
    header.addEventListener("focusin", onFocus)
    sync()
    return () => {
      window.removeEventListener("scroll", onScroll)
      mobile.removeEventListener("change", sync)
      header.removeEventListener("focusin", onFocus)
      if (frame) window.cancelAnimationFrame(frame)
      setCollapsed(false)
      header.removeAttribute("data-compact-nav")
    }
  }, [])
  return null
}
