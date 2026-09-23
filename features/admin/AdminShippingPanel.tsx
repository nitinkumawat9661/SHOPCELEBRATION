"use client"

import { statusHasCapability } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"
import type { AdminOrder } from "./types"

export function AdminShippingPanel({ order, busy, onShipping }: {
  order: AdminOrder
  busy: boolean
  onShipping: (provider: string, trackingNumber: string) => void | Promise<void>
}) {
  const copy = uiContent.admin
  const editable = statusHasCapability(order.status, "shippingUpdate")
  const hasShipping = Boolean(order.shippingProvider && order.shippingTrackingNumber)

  if (editable) {
    return (
      <form key={`${order.publicId}:${order.updatedAt}`} className="shippingForm" onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onShipping(String(data.get("provider") || "").trim(), String(data.get("trackingNumber") || "").trim())
      }}>
        <div className="adminPanelHeading">
          <b>{copy.shippingHeading}</b>
          <span>{order.status === "customer_approved" ? copy.shippingReadyHint : copy.shippingUpdateHint}</span>
        </div>
        <input className="control" name="provider" defaultValue={order.shippingProvider || ""} placeholder={copy.shippingProvider} />
        <input className="control" name="trackingNumber" defaultValue={order.shippingTrackingNumber || ""} placeholder={copy.shippingTracking} />
        <button className="secondary" type="submit" disabled={busy}>{busy ? copy.working : copy.saveShipping}</button>
      </form>
    )
  }

  if (hasShipping) {
    return (
      <div className="adminShippingSaved">
        <b>{copy.shippingSavedHeading}</b>
        <span>{order.shippingProvider}{uiContent.common.separator}{order.shippingTrackingNumber}</span>
      </div>
    )
  }

  return <div className="adminHint">{copy.shippingNotAvailable}</div>
}
