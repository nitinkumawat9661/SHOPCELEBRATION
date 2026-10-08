"use client"

import { useState } from "react"
import { statusHasCapability } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"
import type { AdminOrder } from "./types"

export function AdminShippingPanel({ order, busy, onShipping }: {
  order: AdminOrder
  busy: boolean
  onShipping: (provider: string, trackingNumber: string, weightGrams?: number) => void | Promise<void>
}) {
  const copy = uiContent.admin
  const editable = statusHasCapability(order.status, "shippingUpdate") && (order.orderType === "individual" || order.status !== "preparing")
  const hasShipping = Boolean(order.shippingProvider && order.shippingTrackingNumber)
  const [weight, setWeight] = useState(order.orderType === "individual" ? "80" : "")

  const weightNumber = Number(weight)
  const validWeight = order.orderType === "individual"
    ? Number.isInteger(weightNumber) && weightNumber >= 80 && weightNumber <= 200
    : Number.isInteger(weightNumber) && weightNumber >= 100 && weightNumber <= 30000

  if (editable) {
    return (
      <form key={`${order.publicId}:${order.updatedAt}`} className="shippingForm" onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onShipping(String(data.get("provider") || "").trim(), String(data.get("trackingNumber") || "").trim())
      }}>
        <div className="adminPanelHeading">
          <b>{copy.shippingHeading}</b>
          <span>{order.orderType === "individual" && order.status === "preparing" ? "Pack the jewellery, enter its actual packed weight, then book Shipway." : order.status === "customer_approved" ? "Customer approved the hamper. Enter the packed hamper weight, then book Shipway." : copy.shippingUpdateHint}</span>
        </div>

        {!hasShipping && (order.status === "customer_approved" || (order.orderType === "individual" && order.status === "preparing")) && <div className="adminShippingWeight">
          <label className="field">
            <span>Actual packed weight (grams)</span>
            <input className="control" type="number" inputMode="numeric" min={order.orderType === "individual" ? 80 : 100} max={order.orderType === "individual" ? 200 : 30000} step="1" value={weight} onChange={(event) => setWeight(event.target.value.replace(/\D/g, ""))} placeholder={order.orderType === "individual" ? "80–200 g" : "Enter hamper weight"} />
            <small>{order.orderType === "individual" ? "Jewellery shipment: minimum 80 g, maximum 200 g." : "Weigh the fully packed hamper before booking. The courier rate uses this actual weight."}</small>
          </label>
          <button className="primary" type="button" disabled={busy || !validWeight} onClick={() => onShipping("__SHIPWAY_AUTO__", "", weightNumber)}>{busy ? copy.working : "Book Shipway & generate AWB"}</button>
        </div>}

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
    return <div className="adminShippingSaved"><b>{copy.shippingSavedHeading}</b><span>{order.shippingProvider}{uiContent.common.separator}{order.shippingTrackingNumber}</span>{order.shippingCarrierId && <small>Carrier ID: {order.shippingCarrierId}</small>}{order.shippingLabelUrl && <a className="secondary" href={order.shippingLabelUrl} target="_blank" rel="noreferrer">Open / print shipping label ↗</a>}</div>
  }

  return <div className="adminHint">{copy.shippingNotAvailable}</div>
}
