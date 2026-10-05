"use client"

import { useEffect, useState } from "react"
import { formatMoney } from "../../lib/domain/catalog"
import { fromMinorUnits } from "../../lib/domain/payment"
import { statusHasCapability, workflowActionTarget, type OrderStatus } from "../../lib/domain/order-status"
import { storeContent, uiContent } from "../../lib/domain/content"
import { SiteHeader } from "../shell/SiteHeader"
import { TrustStrip } from "../shell/TrustStrip"
import { SiteFooter } from "../shell/SiteFooter"
import { notifyUx, scrollToUxTarget } from "../ux/UxMessenger"
import { TrackingTimeline } from "./TrackingTimeline"
import { IssueForm } from "./IssueForm"
import { PackingApprovalCard } from "./PackingApprovalCard"
import { TrackingLookup } from "./TrackingLookup"
import { useTrackedOrder } from "./useTrackedOrder"

function customerStatusLabel(status: OrderStatus) {
  if (status === "payment_verification_pending") return "Confirming payment"
  if (status === "payment_verified" || status === "preparing") return "Confirmed"
  if (status === "packing_video_ready" || status === "customer_approved") return "Packing video"
  if (status === "shipped") return "On the way"
  if (status === "delivered") return "Delivered"
  if (status === "issue_reported") return "Support in progress"
  if (status === "refund_or_replacement_resolved") return "Resolved"
  return "Cancelled"
}

export function TrackingPage() {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const legacyToken = url.searchParams.get("token")?.trim() || ""
    const nextToken = hash.get("token")?.trim() || legacyToken
    setToken(nextToken)
    if (legacyToken) {
      url.searchParams.delete("token")
      const search = url.searchParams.toString()
      const safeUrl = `${url.pathname}${search ? `?${search}` : ""}${nextToken ? `#token=${encodeURIComponent(nextToken)}` : ""}`
      window.history.replaceState(null, "", safeUrl)
    }
  }, [])
  const tracked = useTrackedOrder(token || "")
  const [approved, setApproved] = useState(false)
  const [issueSubmitted, setIssueSubmitted] = useState(false)
  const [complaintReference, setComplaintReference] = useState("")
  const [complaintCopy, setComplaintCopy] = useState<{ issueType: string; note: string } | null>(null)
  const copy = uiContent.tracking
  const order = tracked.order
  const individualItemCount = order?.orderType === "individual" ? (order.lineItems || []).reduce((total, item) => total + item.quantity, 0) : 0

  async function approve() {
    if (await tracked.approvePacking()) {
      setApproved(true)
      notifyUx({ title: "Packing approved ✓", body: "Your order can now move to shipping.", tone: "success", durationMs: 4000 })
      window.setTimeout(() => scrollToUxTarget(document.querySelector("[data-tracking-approved]"), "center"), 80)
    } else {
      notifyUx({ title: "Approval nahi hua", body: "Dobara try karein ya WhatsApp support use karein.", tone: "error" })
    }
  }

  function issueDone(complaint: { reference: string; issueType: string; note: string }) {
    setIssueSubmitted(true)
    setComplaintReference(complaint.reference)
    setComplaintCopy({ issueType: complaint.issueType, note: complaint.note })
    tracked.markIssueReported()
    notifyUx({ title: "Issue report ho gaya ✓", body: complaint.reference ? `Complaint reference: ${complaint.reference}` : "Support team ko details mil gayi hain.", tone: "success", durationMs: 4000 })
    window.setTimeout(() => scrollToUxTarget(document.querySelector("[data-issue-success]"), "center"), 80)
  }

  async function copyTracking(number: string) {
    try {
      await navigator.clipboard.writeText(number)
      notifyUx({ title: "Tracking number copied ✓", body: number, tone: "success" })
    } catch {
      notifyUx({ title: "Copy nahi hua", body: `Tracking number: ${number}`, tone: "error" })
    }
  }

  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap trackingWrap">
          <div className="kicker">{copy.title}</div>
          {token === "" && <TrackingLookup />}
          {Boolean(token) && tracked.loading && <div className="trackingState">{copy.loading}</div>}
          {Boolean(token) && tracked.error && !order && <><div className="errorBox" role="alert">{tracked.error}</div><TrackingLookup /></>}
          {order && <>
            <div className="trackingHero"><div><small>{order.orderType === "individual" ? "ORDER" : "HAMPER"}</small><h1>{order.orderType === "individual" ? `${individualItemCount} ${individualItemCount === 1 ? "item" : "items"}` : order.tierName}</h1><p>{order.orderType === "individual" ? `Deliver to ${order.receiverName}` : `${order.receiverName}${uiContent.common.separator}${order.occasion}`}</p></div><strong>{formatMoney(fromMinorUnits(order.amountPaise))}</strong></div>
            {order.orderType === "individual" && <ul className="individualOrderLines" aria-label="Purchased items">{(order.lineItems || []).map((item) => <li key={item.productId}><div><b>{item.name}</b><span>{item.quantity} × {formatMoney(item.unitPricePaise / 100)} each</span></div><strong>{formatMoney(item.lineTotalPaise / 100)}</strong></li>)}</ul>}
            <div className="trackingMeta">
              <div><span>{copy.orderId}</span><b>{order.publicId}</b></div>
              <div><span>{copy.requiredBy}</span><b>{order.requiredDate}</b></div>
              <div><span>{copy.payment}</span><b>{order.paymentStatus}</b></div>
              <div><span>{copy.status}</span><b>{customerStatusLabel(order.status)}</b></div>
            </div>
            {tracked.error && <div className="errorBox" role="alert">{tracked.error}</div>}
            <TrackingTimeline status={order.status} />
            <PackingApprovalCard
              isIndividual={order.orderType === "individual"}
              status={order.status}
              packingVideoUrl={order.packingVideoUrl}
              approving={tracked.approving}
              approvedAt={order.customerApprovedAt}
              onApprove={approve}
            />
            {approved && <div className="successBox" data-tracking-approved>{copy.approved}</div>}
            <div className="trackingCards" style={{ gridTemplateColumns: "1fr" }}>
              <article><div className="promiseIcon">{copy.shippingIcon}</div><h2>{copy.shipping}</h2>{order.shippingTrackingNumber ? <><p>{order.shippingProvider || "Courier"}{uiContent.common.separator}{order.shippingTrackingNumber}</p><button className="secondary" type="button" onClick={() => copyTracking(order.shippingTrackingNumber!)}>Copy tracking number</button></> : <p>Courier details will appear after shipping.</p>}</article>
            </div>
            {statusHasCapability(order.status, "issueReport") && order.issueReportDeadline && <div className="policyNotice issueDeadline"><strong>Issue-report window</strong><span>Report a wrong, damaged, defective or missing-item issue by {new Date(order.issueReportDeadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Statutory rights that cannot legally be excluded are not waived by this operational reporting window.</span></div>}
            {statusHasCapability(order.status, "issueReport") && !issueSubmitted && <IssueForm token={token || ""} onSubmitted={issueDone} onError={tracked.setError} />}
            {(issueSubmitted || order.status === workflowActionTarget("issueReported") || order.status === "refund_or_replacement_resolved") && <div className="successBox" data-issue-success>
              <b>Complaint reference: {complaintReference || `CMP-${order.publicId}`}</b>
              <span>{storeContent.issues.submitted} Use this reference with your Order ID for support.</span>
              {(complaintCopy || (order.issueType && order.issueNote ? { issueType: order.issueType, note: order.issueNote } : null)) && (() => {
                const copy = complaintCopy || { issueType: order.issueType!, note: order.issueNote! }
                return <div className="complaintCopy"><small>Your submitted complaint</small><strong>{copy.issueType}</strong><span>{copy.note}</span></div>
              })()}
            </div>}
          </>}
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
