"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { routes } from "../../config/routes"
import { uiContent } from "../../lib/domain/content"
import { workflowActionTarget } from "../../lib/domain/order-status"
import type { TrackedOrder } from "./types"

type TrackedOrderState = {
  order: TrackedOrder | null
  loading: boolean
  refreshing: boolean
  lastRefreshedAt: Date | null
  refresh: () => Promise<void>
  error: string
  approving: boolean
  setError: (value: string) => void
  approvePacking: () => Promise<boolean>
  markIssueReported: () => void
}

export function useTrackedOrder(token: string): TrackedOrderState {
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [error, setError] = useState("")
  const [approving, setApproving] = useState(false)
  const busy = useRef(false)
  const latestToken = useRef(token)
  latestToken.current = token
  const copy = uiContent.tracking

  const refresh = useCallback(async () => {
    if (!token || busy.current) return
    busy.current = true
    setRefreshing(true)
    try {
      const response = await fetch(routes.api.tracking, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store"
      })
      const result = await response.json() as { ok?: boolean; order?: TrackedOrder }
      if (!response.ok || !result.ok || !result.order) throw new Error(copy.invalid)
      if (latestToken.current === token) {
        setOrder(result.order)
        setError("")
        setLastRefreshedAt(new Date())
      }
    } catch (cause) {
      if (latestToken.current === token) setError(cause instanceof Error ? cause.message : copy.invalid)
    } finally {
      busy.current = false
      if (latestToken.current === token) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [token, copy.invalid])

  useEffect(() => {
    busy.current = false
    setOrder(null)
    setError("")
    setLastRefreshedAt(null)
    setLoading(Boolean(token))
    if (!token) { setLoading(false); return }
    void refresh()
    // Poll only while the browser tab is visible and online. This gets real
    // scans from the courier API, rather than rotating staged timer labels.
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) void refresh()
    }, 60000)
    const onFocus = () => { if (!document.hidden && navigator.onLine) void refresh() }
    document.addEventListener("visibilitychange", onFocus)
    window.addEventListener("online", onFocus)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onFocus)
      window.removeEventListener("online", onFocus)
    }
  }, [token, refresh])

  async function approvePacking() {
    if (!token || !order) return false
    setApproving(true)
    setError("")
    try {
      const response = await fetch(routes.api.approvePacking, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      })
      const result = await response.json() as { ok?: boolean; error?: string; status?: TrackedOrder["status"]; shippingBooked?: boolean }
      if (!response.ok || !result.ok) throw new Error("We couldn’t save your approval right now. Please try again.")
      setOrder({ ...order, status: result.status || workflowActionTarget("customerApproved") })
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.invalid)
      return false
    } finally {
      setApproving(false)
    }
  }

  function markIssueReported() {
    if (order) setOrder({ ...order, status: workflowActionTarget("issueReported") })
  }

  return { order, loading, refreshing, lastRefreshedAt, refresh, error, approving, setError, approvePacking, markIssueReported }
}
