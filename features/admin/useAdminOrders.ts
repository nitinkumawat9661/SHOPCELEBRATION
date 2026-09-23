"use client"

import { useCallback, useEffect, useState } from "react"
import { routes } from "../../config/routes"
import { isPackingVideoMimeType } from "../../lib/domain/storage"
import { validation } from "../../config/validation"
import { errorMessages, uiContent } from "../../lib/domain/content"
import { orderStatusLabels, type OrderStatus } from "../../lib/domain/order-status"
import type { AdminOrder } from "./types"

function messageFor(code: unknown, fallback: string) {
  return typeof code === "string" ? (errorMessages[code] || fallback) : fallback
}

type AdminOrdersState = {
  orders: AdminOrder[]
  error: string
  notice: string
  loading: boolean
  busy: string
  load: () => Promise<void>
  logout: () => Promise<void>
  updateStatus: (order: AdminOrder, status: OrderStatus) => Promise<void>
  saveShipping: (order: AdminOrder, provider: string, trackingNumber: string) => Promise<void>
  uploadVideo: (order: AdminOrder, file: File) => Promise<void>
}

export function useAdminOrders(): AdminOrdersState {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(routes.api.adminOrders, { cache: "no-store" })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(messageFor(result.error, errorMessages.UNKNOWN))
      setOrders(result.orders)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessages.UNKNOWN)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function mutate(orderId: string, task: () => Promise<void>, successMessage: string) {
    setBusy(orderId)
    setError("")
    setNotice("")
    try {
      await task()
      await load()
      setNotice(successMessage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessages.UNKNOWN)
    } finally {
      setBusy("")
    }
  }

  async function updateStatus(order: AdminOrder, status: OrderStatus) {
    return mutate(order.publicId, async () => {
      const response = await fetch(routes.api.adminOrderStatus(order.publicId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(messageFor(result.error, errorMessages.UNKNOWN))
    }, `${uiContent.admin.statusUpdated}: ${orderStatusLabels[status]}`)
  }

  async function saveShipping(order: AdminOrder, provider: string, trackingNumber: string) {
    return mutate(order.publicId, async () => {
      const response = await fetch(routes.api.adminOrderShipping(order.publicId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, trackingNumber })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(messageFor(result.error, errorMessages.UNKNOWN))
    }, uiContent.admin.shippingSavedNotice)
  }

  async function uploadVideo(order: AdminOrder, file: File) {
    return mutate(order.publicId, async () => {
      if (!isPackingVideoMimeType(file.type)) throw new Error(uiContent.admin.videoTypeInvalid)
      if (file.size <= 0 || file.size > validation.packingVideoMaxBytes) throw new Error(uiContent.admin.videoTooLarge)

      const presignResponse = await fetch(routes.api.packingVideoPresign, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.publicId, contentType: file.type })
      })
      const presign = await presignResponse.json()
      if (!presignResponse.ok || !presign.ok) throw new Error(messageFor(presign.error, errorMessages.UNKNOWN))

      const upload = await fetch(presign.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
      if (!upload.ok) throw new Error(errorMessages.UPLOAD_SERVICE_UNAVAILABLE)

      const saveResponse = await fetch(routes.api.adminOrderPackingVideo(order.publicId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: presign.key })
      })
      const saved = await saveResponse.json()
      if (!saveResponse.ok || !saved.ok) throw new Error(messageFor(saved.error, errorMessages.UNKNOWN))
    }, uiContent.admin.videoUploadedNotice)
  }

  async function logout() {
    await fetch(routes.api.adminLogout, { method: "POST" })
    window.location.reload()
  }

  return { orders, error, notice, loading, busy, load, logout, updateStatus, saveShipping, uploadVideo }
}
