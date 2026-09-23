"use client"

import { useState } from "react"
import { statusHasCapability, workflowActionTarget, type OrderStatus } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"

type Props = {
  status: OrderStatus
  packingVideoUrl: string | null
  approving: boolean
  approvedAt: string | null
  onApprove: () => Promise<void>
}

export function PackingApprovalCard({ status, packingVideoUrl, approving, approvedAt, onApprove }: Props) {
  const [confirmed, setConfirmed] = useState(false)
  const copy = uiContent.tracking
  const canApprove = Boolean(packingVideoUrl) && statusHasCapability(status, "packingVideoApproval")
  const alreadyApproved = status === workflowActionTarget("customerApproved") || approvedAt !== null || ["shipped", "delivered", "issue_reported", "refund_or_replacement_resolved"].includes(status)

  if (!packingVideoUrl) {
    return (
      <article className="approvalCard approvalCardWaiting">
        <div className="approvalEyebrow">{copy.approvalKicker}</div>
        <h2>{copy.approvalWaitingTitle}</h2>
        <p>{copy.approvalWaitingBody}</p>
      </article>
    )
  }

  if (alreadyApproved) {
    return (
      <article className="approvalCard approvalCardApproved">
        <div className="approvalStatusIcon">✓</div>
        <div>
          <div className="approvalEyebrow">{copy.approvalKicker}</div>
          <h2>{copy.approvedTitle}</h2>
          <p>{copy.approvedBody}</p>
          {approvedAt && <small>{copy.approvedAtPrefix} {new Date(approvedAt).toLocaleString()}</small>}
        </div>
      </article>
    )
  }

  if (!canApprove) {
    return (
      <article className="approvalCard approvalCardWaiting">
        <div className="approvalEyebrow">{copy.approvalKicker}</div>
        <h2>{copy.approvalUnavailableTitle}</h2>
        <p>{copy.approvalUnavailableBody}</p>
      </article>
    )
  }

  return (
    <article className="approvalCard approvalCardAction">
      <div className="approvalEyebrow">{copy.approvalKicker}</div>
      <h2>{copy.approvalTitle}</h2>
      <p>{copy.approvalBody}</p>
      <label className="approvalConsent">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>{copy.approvalConsent}</span>
      </label>
      <button className="primary approvalButton" type="button" onClick={onApprove} disabled={!confirmed || approving}>
        {approving ? copy.approvalBusy : copy.approve}
      </button>
      <p className="approvalNote">{copy.approvalNote}</p>
    </article>
  )
}
