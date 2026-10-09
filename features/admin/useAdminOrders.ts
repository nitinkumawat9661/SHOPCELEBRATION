"use client"

import { useCallback, useEffect, useState } from "react"
import { routes } from "../../config/routes"
import { packingVideoMimeTypeForFile } from "../../lib/domain/storage"
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
  saveShipping: (order: AdminOrder, provider: string, trackingNumber: string, packed?: { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number }) => Promise<void>
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

  async function saveShipping(order: AdminOrder, provider: string, trackingNumber: string, packed?: { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number }) {
    const shipwayAuto = provider === "__SHIPWAY_AUTO__"
    return mutate(order.publicId, async () => {
      const response = await fetch(routes.api.adminOrderShipping(order.publicId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipwayAuto ? { mode: "shipway", ...packed } : { provider, trackingNumber })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(messageFor(result.error, result.error || errorMessages.UNKNOWN))
      if (shipwayAuto && result.labelUrl) window.open(result.labelUrl, "_blank", "noopener,noreferrer")
    }, shipwayAuto ? "Shipway shipment booked and AWB saved. Order will move to shipped after courier pickup/tracking confirms movement." : uiContent.admin.shippingSavedNotice)
  }

  async function uploadVideo(order: AdminOrder, file: File) {
    return mutate(order.publicId, async () => {
      const contentType = packingVideoMimeTypeForFile(file)
      if (!contentType) throw new Error(uiContent.admin.videoTypeInvalid)
      if (file.size <= 0 || file.size > validation.packingVideoMaxBytes) throw new Error(uiContent.admin.videoTooLarge)

      const initResponse = await fetch(routes.api.packingVideoUpload, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.publicId, contentType, totalBytes: file.size })
      })
      const init = await initResponse.json() as { ok?: boolean; uploadId?: string; chunkSize?: number; error?: string }
      if (!initResponse.ok || !init.ok || !init.uploadId || !init.chunkSize) {
        throw new Error(messageFor(init.error, errorMessages.UPLOAD_SERVICE_UNAVAILABLE))
      }

      const uploadId = init.uploadId
      try {
        for (let offset = 0; offset < file.size; offset += init.chunkSize) {
          const end = Math.min(file.size, offset + init.chunkSize)
          const body = file.slice(offset, end, contentType)
          let uploaded = false
          let lastError = errorMessages.UPLOAD_SERVICE_UNAVAILABLE

          for (let attempt = 0; attempt < 3 && !uploaded; attempt += 1) {
            try {
              const response = await fetch(`${routes.api.packingVideoUpload}?uploadId=${encodeURIComponent(uploadId)}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/octet-stream",
                  "X-Upload-Offset": String(offset)
                },
                body
              })
              const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
              if (response.ok && result.ok) {
                uploaded = true
                break
              }
              lastError = messageFor(result.error, errorMessages.UPLOAD_SERVICE_UNAVAILABLE)
              if (response.status < 500 && response.status !== 429) break
            } catch {
              lastError = errorMessages.UPLOAD_SERVICE_UNAVAILABLE
            }
            if (!uploaded && attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)))
          }

          if (!uploaded) throw new Error(lastError)
        }

        const completeResponse = await fetch(routes.api.packingVideoUpload, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId })
        })
        const completed = await completeResponse.json() as { ok?: boolean; error?: string }
        if (!completeResponse.ok || !completed.ok) {
          throw new Error(messageFor(completed.error, errorMessages.UPLOAD_SERVICE_UNAVAILABLE))
        }
      } catch (error) {
        fetch(routes.api.packingVideoUpload, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId })
        }).catch(() => {})
        throw error
      }
    }, uiContent.admin.videoUploadedNotice)
  }

  async function logout() {
    await fetch(routes.api.adminLogout, { method: "POST" })
    window.location.reload()
  }

  return { orders, error, notice, loading, busy, load, logout, updateStatus, saveShipping, uploadVideo }
}
