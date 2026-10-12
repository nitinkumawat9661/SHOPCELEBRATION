"use client"

import { useEffect, useState } from "react"

const KEY = "celebration.wishlist.v1"
const EVENT = "celebration:wishlist-updated"
const MAX_SAVED = 120
const validId = (id: string) => /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(id)

export function readWishlist(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown
    if (!Array.isArray(stored)) return []
    return [...new Set(stored.filter((value): value is string => typeof value === "string" && validId(value)))].slice(0, MAX_SAVED)
  } catch {
    return []
  }
}

function updateWishlist(ids: string[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

export function useWishlist() {
  const [ids, setIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const refresh = () => { setIds(readWishlist()); setLoaded(true) }
    refresh()
    window.addEventListener(EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  function toggle(productId: string): boolean {
    if (!validId(productId)) return false
    const current = readWishlist()
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [productId, ...current].slice(0, MAX_SAVED)
    return updateWishlist(next)
  }

  return { ids, loaded, toggle }
}
