"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { trackConversion } from "./conversion"

function isCommercePath(pathname: string) {
  return pathname === "/" || pathname === "/cart" || pathname === "/jewelry" || pathname.startsWith("/jewelry/")
}

export function StorefrontAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (!isCommercePath(pathname)) return
    trackConversion("storefront_view")
  }, [pathname])

  return null
}
