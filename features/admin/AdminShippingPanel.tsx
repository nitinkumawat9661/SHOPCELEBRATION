"use client"

import { useState } from "react"
import { statusHasCapability } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"
import type { AdminOrder } from "./types"

export function AdminShippingPanel({ order, busy, onShipping }: {
  order: AdminOrder
  busy: boolean
  onShipping: (provider: string, trackingNumber: string, packed?: { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number }) => void | Promise<void>
}) {
  const copy = uiContent.admin
  const editable = statusHasCapability(order.status, "shippingUpdate") && (order.orderType === "individual" || order.status !== "preparing")
  const hasShipping = Boolean(order.shippingProvider && order.shippingTrackingNumber)
  const [weight, setWeight] = useState("")
  const [length, setLength] = useState("")
  const [breadth, setBreadth] = useState("")
  const [height, setHeight] = useState("")

  const packed = { weightGrams: Number(weight), lengthCm: Number(length), breadthCm: Number(breadth), heightCm: Number(height) }
  const validWeight = order.orderType === "individual"
    ? Number.isInteger(packed.weightGrams) && packed.weightGrams >= 1 && packed.weightGrams <= 5000
    : Number.isInteger(packed.weightGrams) && packed.weightGrams >= 100 && packed.weightGrams <= 30000
  const validDimensions = [packed.lengthCm, packed.breadthCm, packed.heightCm].every((value) => Number.isInteger(value) && value >= 1 && value <= 200)

  if (editable) {
    return (
      <form key={`${order.publicId}:${order.updatedAt}`} className="shippingForm" onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onShipping(String(data.get("provider") || "").trim(), String(data.get("trackingNumber") || "").trim())
      }}>
        <div className="adminPanelHeading">
          <b>{copy.shippingHeading}</b>
          <span>{order.orderType === "individual" && order.status === "preparing" ? "Pack the jewellery, enter actual packed weight and outer parcel dimensions, then book Shipway." : order.status === "customer_approved" ? "Customer approved the hamper. Enter actual packed weight and outer parcel dimensions, then book Shipway." : copy.shippingUpdateHint}</span>
        </div>

        {!hasShipping && (order.status === "customer_approved" || (order.orderType === "individual" && order.status === "preparing")) && <div className="adminShippingWeight">
          <label className="field">
            <span>Actual packed weight (grams)</span>
            <input className="control" type="number" inputMode="numeric" min={order.orderType === "individual" ? 1 : 100} max={order.orderType === "individual" ? 5000 : 30000} step="1" value={weight} onChange={(event) => setWeight(event.target.value.replace(/\D/g, ""))} placeholder="Actual grams" />
            <small>Use the fully packed parcel weight. For one jewellery item this is often small, but always enter the actual value.</small>
          </label>
          <div className="adminShippingDimensions" aria-label="Outer parcel dimensions">
            <label><span>Length (cm)</span><input className="control" type="number" inputMode="numeric" min="1" max="200" step="1" value={length} onChange={(event) => setLength(event.target.value.replace(/\D/g, ""))} /></label>
            <label><span>Breadth (cm)</span><input className="control" type="number" inputMode="numeric" min="1" max="200" step="1" value={breadth} onChange={(event) => setBreadth(event.target.value.replace(/\D/g, ""))} /></label>
            <label><span>Height (cm)</span><input className="control" type="number" inputMode="numeric" min="1" max="200" step="1" value={height} onChange={(event) => setHeight(event.target.value.replace(/\D/g, ""))} /></label>
          </div>
          <small className="adminShippingMeasureHint">Measure the sealed outer parcel. Shipway uses these dimensions for volumetric billing.</small>
          <button className="primary" type="button" disabled={busy || !validWeight || !validDimensions} onClick={() => onShipping("__SHIPWAY_AUTO__", "", packed)}>{busy ? copy.working : "Book Shipway & generate AWB"}</button>
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
