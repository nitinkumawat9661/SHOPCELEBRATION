"use client"

import { useEffect, useState } from "react"
import { routes } from "../../config/routes"
import { uiContent } from "../../lib/domain/content"
import { workflowActionTarget } from "../../lib/domain/order-status"
import type { TrackedOrder } from "./types"

type TrackedOrderState = {
  order: TrackedOrder | null
  loading: boolean
  error: string
  approving: boolean
  setError: (value: string) => void
  approvePacking: () => Promise<boolean>
  markIssueReported: () => void
}

export function useTrackedOrder(token: string): TrackedOrderState {
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [approving, setApproving] = useState(false)
  const copy = uiContent.tracking

  useEffect(() => {
    let active = true
    async function load() {
      if (!token) { setOrder(null); setError(""); setLoading(false); return }
      setOrder(null)
      setLoading(true)
      setError("")
      try {
        const response = await fetch(routes.api.tracking, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" })
        const result = await response.json() as { ok?: boolean; order?: TrackedOrder }
        if (!response.ok || !result.ok || !result.order) throw new Error(copy.invalid)
        if (active) setOrder(result.order)
      } catch (cause) {
        if (active) { setOrder(null); setError(cause instanceof Error ? cause.message : copy.invalid) }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [token, copy.invalid])

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

  return { order, loading, error, approving, setError, approvePacking, markIssueReported }
}
