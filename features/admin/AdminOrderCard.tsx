"use client"

import { useEffect, useState } from "react"
import { formatMoney, productById } from "../../lib/domain/catalog"
import { fromMinorUnits } from "../../lib/domain/payment"
import { adminAllowedTransitions, orderStatusLabels, type OrderStatus } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"
import { AdminOrderVideo } from "./AdminOrderVideo"
import { AdminShippingPanel } from "./AdminShippingPanel"
import type { AdminOrder } from "./types"

export function AdminOrderCard({ order, busy, onStatus, onShipping, onVideo }: {
  order: AdminOrder
  busy: boolean
  onStatus: (status: OrderStatus) => void | Promise<void>
  onShipping: (provider: string, trackingNumber: string) => void | Promise<void>
  onVideo: (file: File) => void | Promise<void>
}) {
  const copy = uiContent.admin
  const next = adminAllowedTransitions(order.status)
  const individual = order.orderType === "individual"
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("")
  const productNames = order.selectedProductNames?.length ? order.selectedProductNames : order.selectedProductIds.map((id) => productById(id)?.name || id)

  useEffect(() => { setSelectedStatus("") }, [order.status])

  async function applyStatus() {
    if (!selectedStatus) return
    if (selectedStatus === "cancelled" && !window.confirm(`${copy.cancelConfirm}\n\nImportant: cancelling the order does NOT automatically initiate a Cashfree refund. If payment was collected, initiate/confirm the eligible refund separately before closing the case.`)) return
    if (selectedStatus === "refund_or_replacement_resolved" && !window.confirm("Mark issue resolved only after the promised replacement/re-delivery is completed OR the approved Cashfree refund has been initiated/confirmed. This status change does not move money. Continue?")) return
    await onStatus(selectedStatus)
    setSelectedStatus("")
  }

  return (
    <article className={`adminOrderCard status-${order.status}`}>
      <div className="adminOrderHead">
        <div className="adminOrderIdentity">
          <div className="adminOrderIdRow">
            <b>{order.publicId}</b>
            <span className="adminStatusChip">{orderStatusLabels[order.status]}</span>
            <span className="adminStatusChip">{individual ? "Individual purchase" : "Hamper"}</span>
          </div>
          <span>{order.customerName}{uiContent.common.separator}<a href={`tel:${order.phone}`}>{order.phone}</a></span>
        </div>
        <div className="adminOrderPrice"><strong>{formatMoney(fromMinorUnits(order.amountPaise))}</strong>{order.discountPaise > 0 && <small><s>{formatMoney(fromMinorUnits(order.subtotalPaise))}</s> • saved {formatMoney(fromMinorUnits(order.discountPaise))}{order.campaignTitle ? ` • ${order.campaignTitle}` : ""}</small>}</div>
      </div>

      <div className="adminNextAction">
        <span>{copy.nextActionLabel}</span>
        <b>{individual && order.status === "payment_verified" ? "Order preparation start karein." : copy.nextAction[order.status]}</b>
      </div>

      <div className="adminInfoGrid">
        <div><span>{individual ? "Order" : copy.hamper}</span><b>{order.tierName}</b></div>
        <div><span>{copy.requiredDate}</span><b>{order.requiredDate}</b></div>
        <div><span>{copy.giftFor}</span><b>{order.receiverName}</b></div>
        <div><span>{copy.paymentReference}</span><b>{order.paymentReference}</b></div>
      </div>

      <div className="adminAddress">
        <span>{copy.deliveryAddress}</span>
        <b>{order.address}, {order.city}, {order.state} - {order.pincode}</b>
      </div>

      {individual && <ul className="individualOrderLines" aria-label="Purchased items">{(order.lineItems || []).map((item) => <li key={item.productId}><div><b>{item.name}</b><span>{item.quantity} × {formatMoney(item.unitPricePaise / 100)} each</span></div><strong>{formatMoney(item.lineTotalPaise / 100)}</strong></li>)}</ul>}

      <details className="adminOrderDetails">
        <summary>{copy.orderDetails}</summary>
        <div className="adminDetailGrid">
          <div><span>{copy.occasion}</span><b>{order.occasion}</b></div>
          {!individual && <div><span>{copy.products}</span><b>{productNames.length ? productNames.join(", ") : uiContent.common.none}</b></div>}
          {order.discountPaise > 0 && <div><span>Offer</span><b>{order.campaignTitle || order.campaignId || "Campaign"} • saved {formatMoney(fromMinorUnits(order.discountPaise))}</b></div>}
          {order.message && <div className="wide"><span>{copy.giftMessage}</span><b>{order.message}</b></div>}
          <div><span>{copy.createdAt}</span><b>{new Date(order.createdAt).toLocaleString()}</b></div>
        </div>
      </details>

      {order.issueType && <div className="adminIssue"><b>{copy.issueHeading}: {order.issueType}</b><span>{order.issueNote}</span>{order.status === "issue_reported" && <small>Before marking resolved: complete the promised replacement/re-delivery or initiate/confirm the approved refund in Cashfree. Status change alone does not refund money.</small>}</div>}

      <AdminOrderVideo order={order} busy={busy} onVideo={onVideo} />
      <AdminShippingPanel order={order} busy={busy} onShipping={onShipping} />

      <div className="adminControls">
        <div className="adminStatusControl">
          <label htmlFor={`status-${order.publicId}`}>{copy.statusAction}</label>
          <select
            id={`status-${order.publicId}`}
            className="control"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as OrderStatus | "")}
            disabled={busy || next.length === 0}
          >
            <option value="">{next.length ? copy.chooseStatus : copy.noStatusActions}</option>
            {next.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}
          </select>
        </div>
        <button className="primary" type="button" disabled={busy || !selectedStatus} onClick={applyStatus}>
          {busy ? copy.working : copy.applyStatus}
        </button>
      </div>
    </article>
  )
}
