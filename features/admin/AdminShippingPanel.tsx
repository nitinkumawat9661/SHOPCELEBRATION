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
          <span>{order.status === "customer_approved" ? "Customer approval complete. Automatic Shipway booking normally runs immediately; use retry only if AWB is still missing." : copy.shippingUpdateHint}</span>
        </div>
        {!hasShipping && order.status === "customer_approved" && <button className="primary" type="button" disabled={busy} onClick={() => onShipping("__SHIPWAY_AUTO__", "")}>{busy ? copy.working : "Retry automatic Shipway booking"}</button>}
        {hasShipping && <div className="adminShippingSaved">
          <b>{copy.shippingSavedHeading}</b>
          <span>{order.shippingProvider}{uiContent.common.separator}{order.shippingTrackingNumber}</span>
          {order.shippingCarrierId && <small>Carrier ID: {order.shippingCarrierId}</small>}
          {order.shippingLabelUrl && <a className="secondary" href={order.shippingLabelUrl} target="_blank" rel="noreferrer">Open / print shipping label ↗</a>}
        </div>}
        <details className="adminOrderDetails">
          <summary>{hasShipping ? "Correct courier / tracking manually" : "Manual courier fallback"}</summary>
          <input className="control" name="provider" defaultValue={order.shippingProvider || ""} placeholder={copy.shippingProvider} />
          <input className="control" name="trackingNumber" defaultValue={order.shippingTrackingNumber || ""} placeholder={copy.shippingTracking} />
          <button className="secondary" type="submit" disabled={busy}>{busy ? copy.working : copy.saveShipping}</button>
        </details>
      </form>
    )
  }

  if (hasShipping) {
    return (
      <div className="adminShippingSaved">
        <b>{copy.shippingSavedHeading}</b>
        <span>{order.shippingProvider}{uiContent.common.separator}{order.shippingTrackingNumber}</span>
        {order.shippingCarrierId && <small>Carrier ID: {order.shippingCarrierId}</small>}
        {order.shippingLabelUrl && <a className="secondary" href={order.shippingLabelUrl} target="_blank" rel="noreferrer">Open / print shipping label ↗</a>}
      </div>
    )
  }

  return <div className="adminHint">{copy.shippingNotAvailable}</div>
}
