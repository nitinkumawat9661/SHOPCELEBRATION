import type { OrderStatus } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"

const milestones = ["Confirmed", "Packing video", "Shipped", "On the way", "Delivered"] as const

function progressIndex(status: OrderStatus) {
  if (status === "payment_verification_pending") return 0
  if (status === "payment_verified" || status === "preparing") return 0
  if (status === "packing_video_ready" || status === "customer_approved") return 1
  if (status === "shipped") return 2
  if (status === "out_for_delivery") return 3
  if (status === "delivered" || status === "issue_reported" || status === "refund_or_replacement_resolved") return 4
  return -1
}

export function TrackingTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return <div className="timeline"><div className="timelineItem done"><span>{uiContent.common.current}</span><div><b>Cancelled</b></div></div></div>
  }

  const currentIndex = progressIndex(status)
  return (
    <div className="timeline" aria-label="Order progress">
      {milestones.map((label, index) => {
        const currentLabel = status === "payment_verification_pending" && index === 0 ? "Confirming payment" : label
        return <div className={`timelineItem ${index <= currentIndex ? "done" : ""}`} key={label}><span>{index < currentIndex ? uiContent.common.yes : index === currentIndex ? uiContent.common.current : ""}</span><div><b>{currentLabel}</b></div></div>
      })}
    </div>
  )
}
