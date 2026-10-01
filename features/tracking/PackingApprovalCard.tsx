"use client"

import { useState } from "react"
import { statusHasCapability, workflowActionTarget, type OrderStatus } from "../../lib/domain/order-status"

type Props = {
  isIndividual?: boolean
  status: OrderStatus
  packingVideoUrl: string | null
  approving: boolean
  approvedAt: string | null
  onApprove: () => Promise<void>
}

export function PackingApprovalCard({ isIndividual = false, status, packingVideoUrl, approving, approvedAt, onApprove }: Props) {
  const [confirmed, setConfirmed] = useState(false)
  const canApprove = Boolean(packingVideoUrl) && statusHasCapability(status, "packingVideoApproval")
  const alreadyApproved = status === workflowActionTarget("customerApproved") || approvedAt !== null || ["shipped", "out_for_delivery", "delivered", "issue_reported", "refund_or_replacement_resolved"].includes(status)

  if (!packingVideoUrl) {
    return (
      <article className="approvalCard approvalCardWaiting">
        <div className="approvalEyebrow">PACKING VIDEO</div>
        <h2>Packing video will appear here</h2>
        <p>We’ll add the packing video before your order is shipped.</p>
      </article>
    )
  }

  if (alreadyApproved) {
    return (
      <article className="approvalCard approvalCardApproved">
        <div className="approvalStatusIcon">✓</div>
        <div>
          <div className="approvalEyebrow">PACKING VIDEO</div>
          <h2>Packing approved</h2>
          <video className="packingVideo" src={packingVideoUrl} controls playsInline preload="metadata" />
          <p>Your approval is recorded. The order can move to shipping.</p>
          {approvedAt && <small>Approved: {new Date(approvedAt).toLocaleString()}</small>}
        </div>
      </article>
    )
  }

  if (!canApprove) {
    return (
      <article className="approvalCard approvalCardWaiting">
        <div className="approvalEyebrow">PACKING VIDEO</div>
        <h2>Packing video ready</h2>
        <video className="packingVideo" src={packingVideoUrl} controls playsInline preload="metadata" />
        <p>Shipping will unlock when this order reaches the packing approval step.</p>
      </article>
    )
  }

  return (
    <article className="approvalCard approvalCardAction">
      <div className="approvalEyebrow">PACKING VIDEO</div>
      <h2>Check packing before shipping</h2>
      <video className="packingVideo" src={packingVideoUrl} controls playsInline preload="metadata" />
      <p>{isIndividual ? "Check your items, then approve this order for shipping." : "Check the packed order, then approve it for shipping."}</p>
      <label className="approvalConsent">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I checked the packing video and approve this order for shipping.</span>
      </label>
      <button className="primary approvalButton" type="button" onClick={onApprove} disabled={!confirmed || approving}>
        {approving ? "Approving…" : "Approve & continue"}
      </button>
      <p className="approvalNote">Courier tracking will appear after shipping.</p>
    </article>
  )
}
