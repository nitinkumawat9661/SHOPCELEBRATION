"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { formatMoney } from "../../lib/domain/catalog"
import { fromMinorUnits } from "../../lib/domain/payment"
import { orderStatusLabels, statusHasCapability, workflowActionTarget } from "../../lib/domain/order-status"
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

export function TrackingPage() {
  const token = useSearchParams().get("token") || ""
  const tracked = useTrackedOrder(token)
  const [approved, setApproved] = useState(false)
  const [issueSubmitted, setIssueSubmitted] = useState(false)
  const copy = uiContent.tracking
  const order = tracked.order

  async function approve() {
    if (await tracked.approvePacking()) {
      setApproved(true)
      notifyUx({ title: "Packing approved ✓", body: "Team ab dispatch process continue kar sakti hai.", tone: "success", durationMs: 4000 })
      window.setTimeout(() => scrollToUxTarget(document.querySelector("[data-tracking-approved]"), "center"), 80)
    } else {
      notifyUx({ title: "Approval nahi hua", body: "Dobara try karein ya WhatsApp support use karein.", tone: "error" })
    }
  }

  function issueDone() {
    setIssueSubmitted(true)
    tracked.markIssueReported()
    notifyUx({ title: "Issue report ho gaya ✓", body: "Support team ko details mil gayi hain.", tone: "success", durationMs: 4000 })
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
          {!token && <TrackingLookup />}
          {token && tracked.loading && <div className="trackingState">{copy.loading}</div>}
          {token && tracked.error && !order && <><div className="errorBox" role="alert">{tracked.error}</div><TrackingLookup /></>}
          {order && <>
            <div className="trackingHero"><div><h1>{order.tierName}</h1><p>{order.receiverName}{uiContent.common.separator}{order.occasion}</p></div><strong>{formatMoney(fromMinorUnits(order.amountPaise))}</strong></div>
            <div className="trackingMeta">
              <div><span>{copy.orderId}</span><b>{order.publicId}</b></div>
              <div><span>{copy.requiredBy}</span><b>{order.requiredDate}</b></div>
              <div><span>{copy.payment}</span><b>{order.paymentStatus}</b></div>
              <div><span>{copy.status}</span><b>{orderStatusLabels[order.status]}</b></div>
            </div>
            {tracked.error && <div className="errorBox" role="alert">{tracked.error}</div>}
            <TrackingTimeline status={order.status} />
            <PackingApprovalCard
              status={order.status}
              packingVideoUrl={order.packingVideoUrl}
              approving={tracked.approving}
              approvedAt={order.customerApprovedAt}
              onApprove={approve}
            />
            {approved && <div className="successBox" data-tracking-approved>{copy.approved}</div>}
            <div className="trackingCards">
              <article><div className="promiseIcon">{copy.packingVideoIcon}</div><h2>{copy.packingVideo}</h2>{order.packingVideoUrl ? <video className="packingVideo" src={order.packingVideoUrl} controls playsInline preload="metadata" /> : <p>{copy.notAvailable}</p>}</article>
              <article><div className="promiseIcon">{copy.shippingIcon}</div><h2>{copy.shipping}</h2>{order.shippingTrackingNumber ? <><p>{order.shippingProvider || "Courier"}{uiContent.common.separator}{order.shippingTrackingNumber}</p><button className="secondary" type="button" onClick={() => copyTracking(order.shippingTrackingNumber!)}>Tracking number copy karein</button></> : <p>{copy.notAvailable}</p>}</article>
            </div>
            {statusHasCapability(order.status, "issueReport") && !issueSubmitted && <IssueForm token={token} onSubmitted={issueDone} onError={tracked.setError} />}
            {(issueSubmitted || order.status === workflowActionTarget("issueReported")) && <div className="successBox" data-issue-success>{storeContent.issues.submitted}</div>}
          </>}
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
