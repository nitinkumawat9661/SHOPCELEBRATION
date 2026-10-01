"use client"

import { useMemo, useSyncExternalStore } from "react"
import { CART_KEY, MAX_CART_ITEMS, MAX_CART_QUANTITY, parseCart, removePurchasedItems, type CartItem } from "./cart"

const eventName = "celebration:cart-change"
let memoryCart = ""
let memoryOnly = false
function snapshot() {
  if (memoryOnly) return memoryCart
  try { return window.localStorage.getItem(CART_KEY) || "" } catch { return memoryCart }
}
function subscribe(notify: () => void) {
  const changed = (event: StorageEvent) => { if (event.key === CART_KEY || event.key === null) notify() }
  window.addEventListener("storage", changed)
  window.addEventListener(eventName, notify)
  return () => {
    window.removeEventListener("storage", changed)
    window.removeEventListener(eventName, notify)
  }
}
function write(items: CartItem[]) {
  memoryCart = JSON.stringify({ v: 1, items })
  try { window.localStorage.setItem(CART_KEY, memoryCart) } catch { memoryOnly = true /* Cart still works in memory when storage is blocked. */ }
  window.dispatchEvent(new Event(eventName))
}

export function useCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "")
  const items = useMemo(() => parseCart(raw), [raw])
  return {
    items,
    count: items.reduce((total, item) => total + item.quantity, 0),
    add(productId: string) {
      const current = parseCart(snapshot())
      const existing = current.find((item) => item.productId === productId)
      if (existing?.quantity === MAX_CART_QUANTITY) return "Maximum 10 of one item per order."
      if (!existing && current.length >= MAX_CART_ITEMS) return "Maximum 20 different items per order."
      const next = existing ? current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { productId, quantity: 1 }]
      if (parseCart(JSON.stringify({ v: 1, items: next })).length !== next.length) return "This item could not be added."
      write(next)
      return ""
    },
    quantity(productId: string, quantity: number) {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) return
      write(parseCart(snapshot()).map((item) => item.productId === productId ? { ...item, quantity } : item))
    },
    remove(productId: string) { write(parseCart(snapshot()).filter((item) => item.productId !== productId)) },
    removePurchased(purchased: CartItem[]) {
      write(removePurchasedItems(parseCart(snapshot()), purchased))
    },
    clear() { write([]) }
  }
}
