"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { StoreIcon } from "./StoreIcon"

export function NotificationLink() {
  const [unread, setUnread] = useState(0)
  const refresh = useCallback(async () => {
    try {
      const result = await fetch("/api/account/orders/message-unread", {
        cache: "no-store", credentials: "same-origin"
      })
      if (!result.ok) { setUnread(0); return }
      const body = await result.json() as { ok?: boolean; unread?: Array<{ unreadCount: number }> }
      if (!body.ok) { setUnread(0); return }
      setUnread((body.unread || []).reduce((total, item) =>
        total + (Number.isSafeInteger(item.unreadCount) && item.unreadCount > 0 ? item.unreadCount : 0), 0))
    } catch {
      // Notifications are optional and should never interfere with shopping.
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onFocus = () => { if (!document.hidden && navigator.onLine) void refresh() }
    const clearThenRefresh = () => { setUnread(0); void refresh() }
    const timer = window.setInterval(onFocus, 60000)
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    window.addEventListener("celebration:notifications-updated", onFocus)
    window.addEventListener("celebration:auth-changed", clearThenRefresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
      window.removeEventListener("celebration:notifications-updated", onFocus)
      window.removeEventListener("celebration:auth-changed", clearThenRefresh)
    }
  }, [refresh])

  return <Link href="/notifications" prefetch={false}
    className="celebrationIconLink celebrationNotificationLink"
    aria-label={unread > 0 ? `Notifications, ${unread} unread messages` : "Notifications and messages"}>
    <StoreIcon name="bell" />
    {unread > 0 && <b className="celebrationNotificationCount" aria-hidden="true">{unread > 99 ? "99+" : unread}</b>}
    <span>Notifications</span>
  </Link>
}
