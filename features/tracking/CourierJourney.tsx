import { COURIER_MILESTONES, courierMilestoneIndex, type CourierPublicStatus } from "../../lib/domain/courier-tracking"
import type { OrderStatus } from "../../lib/domain/order-status"

export function CourierJourney({ courier, unavailable = false, compact = false, orderStatus }: {
  courier: CourierPublicStatus | null
  unavailable?: boolean
  compact?: boolean
  orderStatus?: OrderStatus
}) {
  // My Account uses only this small, five-step status card. The standalone
  // /track page keeps its detailed courier history and external tracking link.
  if (compact) {
    const issue = courier?.stage === "exception" || courier?.stage === "returning"
    const unconfirmed = courier?.stage === "pickup_requested" &&
      !courier.scans.some(scan => scan.occurredAt &&
        /pickup requested|pickup scheduled|out for pickup|shipment booked|data received/i.test(scan.status))
    // Do not claim a carrier physically collected the parcel merely because
    // the merchant marked it shipped; real courier data owns milestones 2–4.
    const reached = courier ? courierMilestoneIndex(courier.stage) : orderStatus === "delivered" ? 4 : 0
    const merchantLabel: Partial<Record<OrderStatus, string>> = {
      payment_verification_pending: "Payment confirmation pending",
      payment_verified: "Payment verified",
      preparing: "Preparing your order",
      packing_video_ready: "Packing video ready",
      customer_approved: "Courier booking next",
      shipped: "Shipped — awaiting courier scans",
      out_for_delivery: "Out for delivery",
      delivered: "Delivered",
      issue_reported: "Support is reviewing your issue",
      refund_or_replacement_resolved: "Your reported issue is resolved",
      cancelled: "Order cancelled"
    }
    const headline = unavailable && !courier
      ? "Tracking temporarily unavailable"
      : courier
        ? courier.code === "OOD" || courier.code === "OFD"
          ? "Arriving today (expected)"
          : unconfirmed ? "Awaiting latest courier scans" : courier.label
        : orderStatus ? merchantLabel[orderStatus] || "Order placed" : "Order placed"
    const labels = ["Placed", "Picked up", "In transit", "Out for delivery", "Delivered"] as const
    return <section className="courierJourney courierJourneyCompact" aria-label="Order delivery progress">
      <div className="courierCompactHead">
        <span className="courierJourneyEyebrow">{courier ? "COURIER UPDATES" : "ORDER PROGRESS"}</span>
        <h3 role="status" aria-live="polite">{headline}</h3>
      </div>
      <ol className="courierMilestones courierMilestonesCompact" aria-label="Delivery milestones">
        {COURIER_MILESTONES.map(({ stage }, index) =>
          <li key={stage} className={reached >= index && !issue ? "reached" : ""}
            aria-current={reached === index && !issue ? "step" : undefined}>
            <span aria-hidden="true" className="courierDot">{reached > index && !issue ? "✓" : ""}</span>
            <span>{labels[index]}</span>
          </li>
        )}
      </ol>
      {issue && <p className="courierCompactAlert" role="status">
        Check your order updates or contact support about this courier exception.
      </p>}
      {unavailable && <p className="courierCompactAlert" role="status">
        Latest courier scans are not available right now.
      </p>}
    </section>
  }
  if (!courier && !unavailable) return null
  const position = courier ? courierMilestoneIndex(courier.stage) : -1
  const issue = courier?.stage === "exception" || courier?.stage === "returning"
  const currentLocation = courier?.lastLocation
  const deliveryToday = courier?.code === "OOD" || courier?.code === "OFD"
  const unconfirmedBookingFeed = courier?.stage === "pickup_requested" &&
    !courier.scans.some(scan => scan.occurredAt &&
      /pickup requested|pickup scheduled|out for pickup|shipment booked|data received/i.test(scan.status))
  return <section className={`courierJourney ${compact ? "courierJourneyCompact" : ""}`} aria-label="Live courier journey">
    <div className="courierJourneyHead">
      <div>
        <span className="courierJourneyEyebrow">COURIER UPDATES</span>
        <h3>{courier ? (deliveryToday ? "Arriving today (expected)" :
          unconfirmedBookingFeed ? "Awaiting latest courier scans" : courier.label) : "Tracking temporarily unavailable"}</h3>
        <p>{unconfirmedBookingFeed
          ? "The API has not supplied confirmed pickup scans. Shipway's tracking page may have a more recent update."
          : courier?.description || "Live tracking could not be loaded. Your saved order status is still available."}</p>
      </div>
      {courier?.courierName && <span className="courierCarrier">{courier.courierName}</span>}
    </div>
    {courier?.stage && <ol className="courierMilestones">
      {COURIER_MILESTONES.map(({ stage, label }, index) =>
        <li key={stage} className={position >= index ? "reached" : ""} aria-current={position === index && !issue ? "step" : undefined}>
          <span aria-hidden="true" className="courierDot">{position > index ? "✓" : ""}</span>
          <span>{label}</span>
        </li>
      )}
    </ol>}
    {issue && <p className="courierException" role="status">Courier alert: {courier?.label}. This does not mean your purchase was automatically cancelled or refunded.</p>}
    {currentLocation && <p className="courierLastScan"><strong>Last reported location:</strong> {currentLocation}</p>}
    {courier?.estimatedDeliveryDate && <p className="courierEstimate"><strong>Estimated delivery:</strong> {courier.estimatedDeliveryDate} <span>(courier estimate, not a guarantee)</span></p>}
    {unavailable && <p className="courierUnavailable" role="status">Live courier tracking could not be refreshed. Displayed history may be incomplete; please use Refresh or the courier tracking link.</p>}
    {courier?.trackUrl && <a className="courierExternal" href={courier.trackUrl} target="_blank" rel="noopener noreferrer">Open courier tracking <span aria-hidden="true">↗</span></a>}
    {Boolean(courier?.scans.length) && <details className="courierHistory">
      <summary>Courier scan history ({courier!.scans.length})</summary>
      <ol>
        {courier!.scans.map((scan, index) => <li key={`${index}:${scan.status}:${scan.occurredAt || ""}`}>
          <strong>{scan.status}</strong>
          {scan.location && <span>{scan.location}</span>}
          {scan.occurredAt && <time>{scan.occurredAt}</time>}
          {scan.details && <small>{scan.details}</small>}
        </li>)}
      </ol>
    </details>}
    <small className="courierJourneyDisclaimer">Updates come from courier scans, not continuous GPS. The website does not assume pickup or delivery before the courier confirms it.</small>
  </section>
}
