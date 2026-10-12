"use client"

import { useSyncExternalStore } from "react"

/** Logged-out shortlist stays on the device. Verified accounts use PostgreSQL. */
const KEY = "celebration.wishlist.v1"
const EVENT = "celebration:wishlist-updated"
const AUTH_EVENT = "celebration:auth-changed"
const MAX_SAVED = 120
const URL = "/api/account/wishlist"
const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)

type WishlistSnapshot = {
  ids: string[]
  loaded: boolean
  pending: boolean
  mode: "guest" | "account" | "error"
  accountId: string | null
  error: string
  notice: string
}
const EMPTY: WishlistSnapshot = { ids: [], loaded: false, pending: false, mode: "guest", accountId: null, error: "", notice: "" }
let current = EMPTY
const listeners = new Set<() => void>()
let started = false
let revision = 0
let lastRefreshAt = 0
let channel: BroadcastChannel | null = null

const notify = () => { for (const listener of listeners) listener() }
function publish(next: WishlistSnapshot) { current = next; notify() }

export function readWishlist(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown
    if (!Array.isArray(stored)) return []
    return [...new Set(stored.filter((value): value is string => typeof value === "string" && validId(value)))].slice(0, MAX_SAVED)
  } catch { return [] }
}
function writeGuest(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch { return false }
}
function announceAccountUpdate() {
  try { channel?.postMessage("refresh") } catch { /* Other tabs can refresh on focus. */ }
}

async function request(method: "GET" | "PUT" | "POST", body?: unknown) {
  const response = await fetch(URL, {
    method, cache: "no-store", credentials: "same-origin",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  })
  const data = await response.json() as { ok?: boolean; error?: string; productIds?: string[] }
  if (!response.ok || !data.ok || !Array.isArray(data.productIds)) throw Error(data.error || "WISHLIST_UNAVAILABLE")
  return data.productIds.filter((id): id is string => typeof id === "string" && validId(id)).slice(0, MAX_SAVED)
}

export async function refreshWishlist(force = false) {
  if (current.pending && !force) return
  if (!force && Date.now() - lastRefreshAt < 12000) return
  const seq = ++revision
  lastRefreshAt = Date.now()
  // Clear old account items during account identity changes. No account-bound
  // wishlist is ever persisted in guest localStorage.
  publish({ ...EMPTY, pending: true })
  try {
    const response = await fetch("/api/account/me", { cache: "no-store", credentials: "same-origin" })
    const data = await response.json() as { ok?: boolean; account?: { id?: string } | null }
    if (!response.ok || !data.ok) throw Error("ACCOUNT_LOOKUP_FAILED")
    if (seq !== revision) return
    if (!data.account?.id) {
      publish({ ...EMPTY, ids: readWishlist(), loaded: true, mode: "guest" })
      return
    }
    const accountId = data.account.id
    let ids = await request("GET")
    if (seq !== revision) return
    const guest = readWishlist()
    let notice = ""
    if (guest.length) {
      // Merge, never replace another device's saved pieces. Clear local guest
      // data only AFTER the server confirms the merge.
      ids = await request("POST", { productIds: guest })
      if (seq !== revision) return
      if (guest.some(id => !ids.includes(id))) notice = "Some previously saved pieces could not be imported because they are unavailable or your list is full."
      try { window.localStorage.removeItem(KEY) } catch { /* No guest data loss on storage failure. */ }
      announceAccountUpdate()
    }
    publish({ ids, loaded: true, pending: false, mode: "account", accountId, error: "", notice })
  } catch {
    if (seq === revision) publish({ ...EMPTY, loaded: true, mode: "error", error: "Saved pieces could not sync. Check your connection and retry." })
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!started && typeof window !== "undefined") {
    started = true
    const trigger = () => { if (!document.hidden && navigator.onLine && !current.pending) void refreshWishlist() }
    const authChanged = () => { void refreshWishlist(true) }
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== KEY) return
      if (current.mode === "guest") publish({ ...current, ids: readWishlist() })
    }
    window.addEventListener("focus", trigger)
    window.addEventListener("pageshow", trigger)
    window.addEventListener("online", trigger)
    window.addEventListener("storage", storageChanged)
    window.addEventListener(AUTH_EVENT, authChanged)
    document.addEventListener("visibilitychange", trigger)
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("celebration-wishlist")
      channel.onmessage = () => { if (!current.pending) void refreshWishlist(true) }
    }
    window.setInterval(() => { if (!document.hidden && navigator.onLine && !current.pending) void refreshWishlist(true) }, 45000)
    void refreshWishlist(true)
  }
  return () => { listeners.delete(listener) }
}

async function toggle(productId: string): Promise<boolean> {
  if (!validId(productId) || !current.loaded || current.pending || current.mode === "error") return false
  const previous = current
  if (previous.mode === "guest") {
    const ids = previous.ids.includes(productId)
      ? previous.ids.filter(id => id !== productId)
      : [productId, ...previous.ids].slice(0, MAX_SAVED)
    return writeGuest(ids) && (publish({ ...previous, ids }), true)
  }
  const seq = ++revision
  publish({ ...previous, pending: true, error: "" })
  try {
    const ids = await request("PUT", { productId, saved: !previous.ids.includes(productId) })
    if (seq !== revision) return false
    publish({ ...previous, ids, pending: false, error: "" })
    announceAccountUpdate()
    return true
  } catch {
    if (seq === revision) publish({ ...previous, pending: false, error: "Couldn’t sync that piece. Try again." })
    return false
  }
}
const snapshot = () => current
const serverSnapshot = () => EMPTY

export function useWishlist() {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  return { ...state, toggle, refresh: () => refreshWishlist(true) }
}
