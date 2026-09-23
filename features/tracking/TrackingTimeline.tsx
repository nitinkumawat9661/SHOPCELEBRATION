import { customerTimeline, orderStatusLabels, type OrderStatus } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"

export function TrackingTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = customerTimeline.indexOf(status)
  return (
    <div className="timeline">
      {customerTimeline.map((item, index) => <div className={`timelineItem ${index <= currentIndex ? "done" : ""}`} key={item}><span>{index < currentIndex ? uiContent.common.yes : index === currentIndex ? uiContent.common.current : ""}</span><div><b>{orderStatusLabels[item]}</b></div></div>)}
    </div>
  )
}
